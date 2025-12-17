"""
Función Lambda para procesar ECG completo
Hace todo el pipeline: parsear CSV, procesar señal, llamar a SageMaker
"""

import json
import os
import boto3
import logging
import csv
import io
import math
from typing import Dict, List, Any, Tuple
from botocore.exceptions import ClientError

# Configurar logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Cliente de SageMaker Runtime
sagemaker_runtime = None

def get_sagemaker_client():
    """Inicializa el cliente de SageMaker Runtime"""
    global sagemaker_runtime
    if sagemaker_runtime is None:
        region = os.environ.get('AWS_REGION', 'us-east-1')
        sagemaker_runtime = boto3.client('sagemaker-runtime', region_name=region)
    return sagemaker_runtime


# ============================================================================
# PIPELINE DE PROCESAMIENTO DE SEÑAL
# ============================================================================

def parse_csv_content(csv_content: str) -> Tuple[List[float], List[float], List[float], List[float], float, Dict[str, Any]]:
    """Parsea el contenido CSV y extrae las señales y metadata"""
    reader = csv.DictReader(io.StringIO(csv_content))
    
    tiempo_s = []
    II = []
    V1 = []
    V5 = []
    labels = []
    is_anomalo_list = []
    
    for row in reader:
        if 'tiempo_s' in row and row['tiempo_s']:
            tiempo_s.append(float(row['tiempo_s']))
        if 'II' in row and row['II']:
            II.append(float(row['II']))
        if 'V1' in row and row['V1']:
            V1.append(float(row['V1']))
        if 'V5' in row and row['V5']:
            V5.append(float(row['V5']))
        # Extraer etiquetas si existen
        # IMPORTANTE: Verificar que existe y no es None/vacío, pero 0 es válido
        # csv.DictReader lee todo como strings, así que "0" es válido
        if 'label' in row:
            label_str = str(row['label']).strip() if row['label'] is not None else ''
            if label_str != '':
                try:
                    label_val = int(float(label_str))
                    labels.append(label_val)  # 0 y 1 son valores válidos
                except (ValueError, TypeError):
                    pass
        
        # Extraer is_anomalo si existe
        # IMPORTANTE: False es un valor válido, no debe ser descartado
        # csv.DictReader lee "False" como string, no como boolean
        if 'is_anomalo' in row:
            is_anomalo_str = str(row['is_anomalo']).strip() if row['is_anomalo'] is not None else ''
            if is_anomalo_str != '':
                try:
                    # Siempre viene como string desde CSV
                    val_lower = is_anomalo_str.lower()
                    # "false", "0", "no" → False (Normal)
                    # "true", "1", "yes" → True (Anómalo)
                    is_anomalo_list.append(val_lower in ['true', '1', 'yes'])
                except (ValueError, TypeError):
                    pass
    
    # Calcular frecuencia de muestreo
    fs = 500  # Valor por defecto
    if len(tiempo_s) > 1:
        time_diff = tiempo_s[1] - tiempo_s[0]
        if time_diff > 0:
            fs = 1 / time_diff
    
    # Determinar etiqueta real (si está disponible)
    # Prioridad: label > is_anomalo (si ambos existen, usar label)
    metadata = {}
    if labels:
        # Usar la primera etiqueta (todas las filas deberían tener la misma)
        label_real = labels[0] if labels else None
        if label_real is not None:
            metadata['label_real'] = int(label_real)
            metadata['is_anomalo_real'] = (label_real == 1)
    elif is_anomalo_list:
        # Usar is_anomalo si está disponible (todas las filas deberían tener el mismo valor)
        is_anomalo_real = is_anomalo_list[0] if is_anomalo_list else None
        if is_anomalo_real is not None:
            metadata['is_anomalo_real'] = bool(is_anomalo_real)
            metadata['label_real'] = 1 if is_anomalo_real else 0
    
    # Si tenemos ambos, usar label como fuente de verdad (más confiable)
    if labels and is_anomalo_list:
        label_real = labels[0]
        is_anomalo_real = is_anomalo_list[0]
        # Verificar consistencia (solo para logging, no afecta el resultado)
        if (label_real == 1) != is_anomalo_real:
            logger.warning(f"Inconsistencia detectada: label={label_real} pero is_anomalo={is_anomalo_real}. Usando label como fuente de verdad.")
        # Usar label como fuente de verdad
        metadata['label_real'] = int(label_real)
        metadata['is_anomalo_real'] = (label_real == 1)
    
    return II, V1, V5, tiempo_s, fs, metadata


def raw_to_signal(II: List[float], V1: List[float], V5: List[float]) -> List[List[float]]:
    """Convierte las señales raw a formato estándar [muestras, 3 canales]"""
    num_samples = min(len(II), len(V1), len(V5))
    signal = []
    for i in range(num_samples):
        signal.append([II[i] if i < len(II) else 0,
                       V1[i] if i < len(V1) else 0,
                       V5[i] if i < len(V5) else 0])
    return signal


def check_quality(signal: List[List[float]], fs: float) -> Dict[str, Any]:
    """Etapa 1: Chequeo de calidad"""
    num_samples = len(signal)
    num_channels = len(signal[0]) if signal else 0
    
    if num_samples == 0:
        return {
            'status': 'RECHAZADA',
            'mensaje': 'Señal vacía',
            'razon_rechazo': 'La señal no contiene muestras'
        }
    
    if num_channels != 3:
        return {
            'status': 'RECHAZADA',
            'mensaje': f'Número de canales incorrecto: {num_channels} (se esperan 3)',
            'razon_rechazo': 'Formato de señal inválido'
        }
    
    duration = num_samples / fs
    if duration < 5:
        return {
            'status': 'RECHAZADA',
            'mensaje': f'Duración insuficiente: {duration:.2f}s (mínimo: 5s)',
            'razon_rechazo': 'Duración mínima no alcanzada',
            'duracion_segundos': duration,
            'fs_original': fs
        }
    
    # Validar cada canal
    for channel in range(num_channels):
        channel_values = [s[channel] for s in signal if len(s) > channel and 
                          not (s[channel] != s[channel] or not (-1e10 < s[channel] < 1e10))]
        
        if len(channel_values) == 0:
            return {
                'status': 'RECHAZADA',
                'mensaje': f'Canal {channel} completamente inválido',
                'razon_rechazo': 'Canal sin valores válidos'
            }
        
        # Calcular estadísticas
        mean = sum(channel_values) / len(channel_values)
        variance = sum((v - mean) ** 2 for v in channel_values) / len(channel_values)
        std_dev = variance ** 0.5
        
        if std_dev < 0.01:
            return {
                'status': 'RECHAZADA',
                'mensaje': f'Canal {channel} tiene desviación estándar muy baja: {std_dev:.6f}',
                'razon_rechazo': 'Señal demasiado plana'
            }
    
    return {
        'status': 'OK',
        'mensaje': 'Señal válida',
        'duracion_segundos': duration,
        'fs_original': fs
    }


def apply_notch_filter(signal: List[float], fs: float, notch_freq: float = 50, Q: float = 30) -> List[float]:
    """Aplica filtro notch para eliminar ruido de red"""
    
    w0 = (2 * math.pi * notch_freq) / fs
    alpha = math.sin(w0) / (2 * Q)
    cosw0 = math.cos(w0)
    
    b0, b1, b2 = 1, -2 * cosw0, 1
    a0, a1, a2 = 1 + alpha, -2 * cosw0, 1 - alpha
    
    b = [b0 / a0, b1 / a0, b2 / a0]
    a = [1, a1 / a0, a2 / a0]
    
    filtered = [0.0] * len(signal)
    x1, x2, y1, y2 = 0.0, 0.0, 0.0, 0.0
    
    for i in range(len(signal)):
        x = signal[i]
        y = b[0] * x + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
        filtered[i] = y
        x2, x1 = x1, x
        y2, y1 = y1, y
    
    return filtered


def apply_bandpass_filter(signal: List[float], fs: float, low_freq: float = 0.5, high_freq: float = 40) -> List[float]:
    """Aplica filtro pasa banda"""
    import math
    # High-pass
    rc = 1 / (2 * math.pi * low_freq)
    dt = 1 / fs
    alpha = rc / (rc + dt)
    
    high_passed = [signal[0]]
    for i in range(1, len(signal)):
        high_passed.append(alpha * (high_passed[i-1] + signal[i] - signal[i-1]))
    
    # Low-pass
    rc = 1 / (2 * math.pi * high_freq)
    alpha = dt / (rc + dt)
    
    low_passed = [high_passed[0]]
    for i in range(1, len(high_passed)):
        low_passed.append(low_passed[i-1] + alpha * (high_passed[i] - low_passed[i-1]))
    
    return low_passed


def filter_signal(signal: List[List[float]], fs: float) -> Tuple[List[List[float]], Dict[str, Any]]:
    """Etapa 2: Filtrado"""
    try:
        num_samples = len(signal)
        num_channels = len(signal[0]) if signal else 3
        
        filtered = [[0.0] * num_channels for _ in range(num_samples)]
        
        for channel in range(num_channels):
            channel_signal = [s[channel] for s in signal]
            
            # Notch filter
            notch_freq = 60 if fs > 300 else 50
            notch_filtered = apply_notch_filter(channel_signal, fs, notch_freq)
            
            # Bandpass filter
            bandpass_filtered = apply_bandpass_filter(notch_filtered, fs, 0.5, 40)
            
            for i in range(num_samples):
                filtered[i][channel] = bandpass_filtered[i] if i < len(bandpass_filtered) else 0
        
        return filtered, {
            'status': 'OK',
            'mensaje': 'Filtrado completado exitosamente',
            'filtros_aplicados': ['notch', 'banda_pasante']
        }
    except Exception as e:
        logger.error(f"Error en filtrado: {str(e)}")
        return signal, {
            'status': 'ERROR',
            'mensaje': f'Error en filtrado: {str(e)}',
            'filtros_aplicados': []
        }


def normalize_signal(signal: List[List[float]]) -> Tuple[List[List[float]], Dict[str, Any]]:
    """Etapa 3: Normalización Min-Max"""
    try:
        num_samples = len(signal)
        num_channels = len(signal[0]) if signal else 3
        
        normalized = [[0.0] * num_channels for _ in range(num_samples)]
        
        for channel in range(num_channels):
            channel_values = [s[channel] for s in signal 
                             if len(s) > channel and 
                             not (s[channel] != s[channel] or not (-1e10 < s[channel] < 1e10))]
            
            if len(channel_values) == 0:
                for i in range(num_samples):
                    normalized[i][channel] = signal[i][channel] if i < len(signal) and len(signal[i]) > channel else 0
                continue
            
            # Min-Max normalization: (x - min) / (max - min)
            min_val = min(channel_values)
            max_val = max(channel_values)
            range_val = max_val - min_val
            
            # Evitar división por cero si el canal es completamente plano
            if range_val < 1e-10:
                range_val = 1.0
            
            for i in range(num_samples):
                value = signal[i][channel] if i < len(signal) and len(signal[i]) > channel else 0
                if -1e10 < value < 1e10 and value == value:  # Check for NaN and Inf
                    normalized[i][channel] = (value - min_val) / range_val
                else:
                    normalized[i][channel] = 0
        
        return normalized, {
            'status': 'OK',
            'mensaje': 'Normalización completada exitosamente',
            'metodo': 'min-max (por canal)'
        }
    except Exception as e:
        logger.error(f"Error en normalización: {str(e)}")
        return signal, {
            'status': 'ERROR',
            'mensaje': f'Error en normalización: {str(e)}',
            'metodo': 'ninguno'
        }


def resample_to_200hz(signal: List[List[float]], original_fs: float) -> Tuple[List[List[float]], Dict[str, Any]]:
    """Etapa 4: Resampling a 200 Hz"""
    target_fs = 200
    num_channels = len(signal[0]) if signal else 3
    original_samples = len(signal)
    
    try:
        if abs(original_fs - target_fs) < 0.1:
            return signal, {
                'status': 'OK',
                'mensaje': 'Señal ya está a 200 Hz',
                'fs_final': target_fs,
                'muestras_originales': original_samples,
                'muestras_finales': original_samples
            }
        
        duration = original_samples / original_fs
        target_samples = int(round(duration * target_fs))
        
        resampled = [[0.0] * num_channels for _ in range(target_samples)]
        
        for channel in range(num_channels):
            channel_signal = [s[channel] for s in signal]
            resampled_channel = [0.0] * target_samples
            
            for i in range(target_samples):
                t = (i / target_fs) * original_fs
                index = int(t)
                fraction = t - index
                
                if index >= original_samples - 1:
                    resampled_channel[i] = channel_signal[original_samples - 1]
                else:
                    resampled_channel[i] = (channel_signal[index] * (1 - fraction) + 
                                          channel_signal[index + 1] * fraction)
            
            for i in range(target_samples):
                resampled[i][channel] = resampled_channel[i]
        
        return resampled, {
            'status': 'OK',
            'mensaje': f'Resampling completado: {original_fs} Hz → {target_fs} Hz',
            'fs_final': target_fs,
            'muestras_originales': original_samples,
            'muestras_finales': target_samples
        }
    except Exception as e:
        logger.error(f"Error en resampling: {str(e)}")
        return signal, {
            'status': 'ERROR',
            'mensaje': f'Error en resampling: {str(e)}',
            'fs_final': original_fs,
            'muestras_originales': original_samples,
            'muestras_finales': original_samples
        }


def convert_to_model_input(signal: List[List[float]], target_length: int = 2000) -> List[List[List[float]]]:
    """Convierte señal a formato del modelo [1, 2000, 3]"""
    num_channels = len(signal[0]) if signal else 3
    current_length = len(signal)
    
    model_input = [[[0.0] * num_channels for _ in range(target_length)]]
    
    for i in range(target_length):
        if i < current_length:
            for channel in range(num_channels):
                model_input[0][i][channel] = signal[i][channel] if len(signal[i]) > channel else 0
        else:
            for channel in range(num_channels):
                model_input[0][i][channel] = 0.0
    
    return model_input


# ============================================================================
# HANDLER PRINCIPAL
# ============================================================================

def lambda_handler(event, context):
    """
    Handler principal de Lambda
    
    Espera:
    - event["body"]: JSON string con {"csvContent": "..."}
    
    Retorna:
    - Respuesta completa con todas las etapas procesadas
    """
    
    cors_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
    
    # Manejar preflight OPTIONS
    if event.get('httpMethod') == 'OPTIONS' or event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({'message': 'OK'})
        }
    
    try:
        # Parsear body
        body = event.get('body', '{}')
        if isinstance(body, str):
            request_data = json.loads(body)
        else:
            request_data = body
        
        csv_content = request_data.get('csvContent')
        if not csv_content:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': 'csvContent es requerido'})
            }
        
        # 1. Parsear CSV
        II, V1, V5, tiempo_s, original_fs, metadata = parse_csv_content(csv_content)
        signal_original = raw_to_signal(II, V1, V5)
        
        # 2. Etapa 1: Chequeo de calidad
        quality_check = check_quality(signal_original, original_fs)
        if quality_check['status'] == 'RECHAZADA':
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'signal_original': signal_original,
                    'signal_filtrada': None,
                    'signal_normalizada': None,
                    'signal_resampleada': None,
                    'tensor_final': None,
                    'estados': {
                        'calidad': quality_check,
                        'filtrado': {'status': 'ERROR', 'mensaje': 'No se procesó debido a fallo en calidad', 'filtros_aplicados': []},
                        'normalizacion': {'status': 'ERROR', 'mensaje': 'No se procesó debido a fallo en calidad', 'metodo': 'ninguno'},
                        'resampling': {'status': 'ERROR', 'mensaje': 'No se procesó debido a fallo en calidad', 
                                      'fs_final': original_fs, 'muestras_originales': len(signal_original), 
                                      'muestras_finales': len(signal_original)}
                    },
                    'prediccion': None,
                    'modelo': {'nombre': 'N/A', 'endpoint': 'N/A'},
                    'etiqueta_real': metadata if metadata else None
                })
            }
        
        # 3. Etapa 2: Filtrado
        signal_filtrada, filter_result = filter_signal(signal_original, original_fs)
        if filter_result['status'] == 'ERROR':
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'signal_original': signal_original,
                    'signal_filtrada': signal_filtrada,
                    'signal_normalizada': None,
                    'signal_resampleada': None,
                    'tensor_final': None,
                    'estados': {
                        'calidad': quality_check,
                        'filtrado': filter_result,
                        'normalizacion': {'status': 'ERROR', 'mensaje': 'No se procesó debido a fallo en filtrado', 'metodo': 'ninguno'},
                        'resampling': {'status': 'ERROR', 'mensaje': 'No se procesó debido a fallo en filtrado',
                                      'fs_final': original_fs, 'muestras_originales': len(signal_original),
                                      'muestras_finales': len(signal_original)}
                    },
                    'prediccion': None,
                    'modelo': {'nombre': 'N/A', 'endpoint': 'N/A'},
                    'etiqueta_real': metadata if metadata else None
                })
            }
        
        # 4. Etapa 3: Normalización
        signal_normalizada, normalization_result = normalize_signal(signal_filtrada)
        if normalization_result['status'] == 'ERROR':
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'signal_original': signal_original,
                    'signal_filtrada': signal_filtrada,
                    'signal_normalizada': signal_normalizada,
                    'signal_resampleada': None,
                    'tensor_final': None,
                    'estados': {
                        'calidad': quality_check,
                        'filtrado': filter_result,
                        'normalizacion': normalization_result,
                        'resampling': {'status': 'ERROR', 'mensaje': 'No se procesó debido a fallo en normalización',
                                      'fs_final': original_fs, 'muestras_originales': len(signal_original),
                                      'muestras_finales': len(signal_original)}
                    },
                    'prediccion': None,
                    'modelo': {'nombre': 'N/A', 'endpoint': 'N/A'},
                    'etiqueta_real': metadata if metadata else None
                })
            }
        
        # 5. Etapa 4: Resampling
        signal_resampleada, resampling_result = resample_to_200hz(signal_normalizada, original_fs)
        if resampling_result['status'] == 'ERROR':
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'signal_original': signal_original,
                    'signal_filtrada': signal_filtrada,
                    'signal_normalizada': signal_normalizada,
                    'signal_resampleada': signal_resampleada,
                    'tensor_final': None,
                    'estados': {
                        'calidad': quality_check,
                        'filtrado': filter_result,
                        'normalizacion': normalization_result,
                        'resampling': resampling_result
                    },
                    'prediccion': None,
                    'modelo': {'nombre': 'N/A', 'endpoint': 'N/A'},
                    'etiqueta_real': metadata if metadata else None
                })
            }
        
        # 6. Convertir a tensor
        model_input = convert_to_model_input(signal_resampleada, 2000)
        tensor_info = {
            'shape': [1, len(model_input[0]), len(model_input[0][0]) if model_input[0] else 3],
            'muestra_preview': model_input
        }
        
        # 7. Llamar a SageMaker
        prediccion = None
        modelo_info = {'nombre': 'N/A', 'endpoint': 'N/A', 'metadata': {}}
        
        try:
            endpoint_name = os.environ.get('SAGEMAKER_ENDPOINT', 'cnn1d-lstm-ecg-v1-serverless')
            client = get_sagemaker_client()
            
            payload = {'signals': model_input}
            payload_json = json.dumps(payload, ensure_ascii=False)
            
            response = client.invoke_endpoint(
                EndpointName=endpoint_name,
                ContentType='application/json',
                Body=payload_json.encode('utf-8')
            )
            
            response_body = response['Body'].read().decode('utf-8')
            model_response = json.loads(response_body)
            
            probability = model_response.get('probability') or model_response.get('prediction') or 0
            clase = 'anomalo' if probability > 0.5 else 'normal'
            
            prediccion = {
                'clase': clase,
                'score': float(probability)
            }
            
            modelo_info = {
                'nombre': 'CNN1D-LSTM ECG v1',
                'endpoint': endpoint_name,
                'metadata': {}
            }
        except Exception as sagemaker_error:
            logger.error(f"Error llamando a SageMaker: {str(sagemaker_error)}")
            # Continuar sin predicción
        
        # 8. Construir respuesta completa
        response_data = {
            'signal_original': signal_original,
            'signal_filtrada': signal_filtrada,
            'signal_normalizada': signal_normalizada,
            'signal_resampleada': signal_resampleada,
            'tensor_final': tensor_info,
            'estados': {
                'calidad': quality_check,
                'filtrado': filter_result,
                'normalizacion': normalization_result,
                'resampling': resampling_result
            },
            'prediccion': prediccion,
            'modelo': modelo_info,
            'etiqueta_real': metadata if metadata else None  # Incluir etiqueta real del CSV si está disponible
        }
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps(response_data)
        }
        
    except Exception as e:
        logger.error(f"Error procesando ECG: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'error': 'Error procesando ECG',
                'message': str(e)
            })
        }

