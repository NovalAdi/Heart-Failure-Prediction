import sys
import os
import json
import joblib
import pandas as pd
import numpy as np

def encode_patient_data(patient, n_features):
    # Mapping default untuk dataset Heart Failure Kaggle jika model dilatih dengan Label Encoding
    # 11 fitur: Age, Sex, ChestPainType, RestingBP, Cholesterol, FastingBS, RestingECG, MaxHR, ExerciseAngina, Oldpeak, ST_Slope
    
    # 1. Sex encoding
    sex_map = {'M': 1, 'F': 0}
    sex_val = sex_map.get(patient.get('sex', 'M'), 1)
    
    # 2. Chest Pain Type encoding
    # Urutan abjad standar atau urutan data: ASY=0, ATA=1, NAP=2, TA=3
    cp_map = {'ASY': 0, 'ATA': 1, 'NAP': 2, 'TA': 3}
    cp_val = cp_map.get(patient.get('chestPainType', 'ASY'), 0)
    
    # 3. Resting ECG encoding
    # LVH=0, Normal=1, ST=2
    ecg_map = {'LVH': 0, 'Normal': 1, 'ST': 2}
    ecg_val = ecg_map.get(patient.get('restingECG', 'Normal'), 1)
    
    # 4. Exercise Angina encoding
    ex_map = {'N': 0, 'Y': 1}
    ex_val = ex_map.get(patient.get('exerciseAngina', 'N'), 0)
    
    # 5. ST Slope encoding
    # Down=0, Flat=1, Up=2
    slope_map = {'Down': 0, 'Flat': 1, 'Up': 2}
    slope_val = slope_map.get(patient.get('stSlope', 'Flat'), 1)
    
    if n_features == 11:
        # Standard Heart Failure dataset features
        features = [
            float(patient.get('age', 55)),
            float(sex_val),
            float(cp_val),
            float(patient.get('restingBP', 120)),
            float(patient.get('cholesterol', 200)),
            float(patient.get('fastingBS', 0)),
            float(ecg_val),
            float(patient.get('maxHR', 140)),
            float(ex_val),
            float(patient.get('oldpeak', 0.0)),
            float(slope_val)
        ]
        return np.array([features])
    elif n_features == 10:
        # E-Nose sensor dataset features (MQ135, MQ136, MQ2, MQ3, MQ4, MQ5, MQ6, MQ8, MQ9, Temperature)
        # Jika data yang dikirim adalah E-Nose, kita ambil langsung nilainya dari input.
        # Jika data yang dikirim adalah Heart Failure, tapi modelnya 10 fitur (E-Nose), kita return default/error.
        features = [
            float(patient.get('MQ135', 24.0)),
            float(patient.get('MQ136', 19.0)),
            float(patient.get('MQ2', 40.0)),
            float(patient.get('MQ3', 18.0)),
            float(patient.get('MQ4', 39.0)),
            float(patient.get('MQ5', 38.0)),
            float(patient.get('MQ6', 32.0)),
            float(patient.get('MQ8', 40.0)),
            float(patient.get('MQ9', 13.0)),
            float(patient.get('Temperature', 30.0))
        ]
        return np.array([features])
    else:
        # Fallback jika model memiliki jumlah fitur berbeda (misal One-Hot Encoded dari Colab)
        # Kami mengembalikan array kosong dan akan memprosesnya di fungsi pemanggil
        return None

def main():
    try:
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument('--model', type=str, default='svm', choices=['svm', 'dt', 'knn', 'nn'])
        args, unknown = parser.parse_known_args()

        # Ambil input JSON dari Node.js (stdin)
        input_data = json.loads(sys.stdin.read())
        
        # Cari lokasi model dan scaler
        dir_path = os.path.dirname(os.path.realpath(__file__))
        model_dir = os.path.join(dir_path, 'models')
        
        model_filenames = {
            'svm': 'heartf_svm.sav',
            'dt': 'heartf_dt.sav',
            'knn': 'heartf_knn.sav',
            'nn': 'heartf_nn.sav'
        }
        model_file = model_filenames.get(args.model, 'heartf_svm.sav')
        
        model_path = os.path.join(model_dir, model_file)
        scaler_path = os.path.join(model_dir, 'scaler_heartf.sav')
        
        # Fallback jika belum dipindahkan ke folder React
        if not os.path.exists(model_path):
            fallback_dir = '/Applications/XAMPP/xamppfiles/htdocs/tubes_dasildat/model'
            model_path = os.path.join(fallback_dir, model_file)
            scaler_path = os.path.join(fallback_dir, 'scaler_heartf.sav')
            
        if not os.path.exists(model_path):
            # Mencari model alternatif dengan nama generic
            alternative_model = os.path.join(model_dir, 'model.sav')
            alternative_scaler = os.path.join(model_dir, 'scaler.sav')
            if os.path.exists(alternative_model):
                model_path = alternative_model
                scaler_path = alternative_scaler
        
        if not os.path.exists(model_path):
            print(json.dumps({'error': f'Model file not found. Please place heartf_svm.sav or model.sav in {model_dir}'}))
            return

        # Load model dan scaler
        classifier = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
        
        # Dapatkan jumlah fitur yang diharapkan
        n_features = 11
        if hasattr(scaler, 'n_features_in_'):
            n_features = scaler.n_features_in_
            
        # Periksa apakah request berupa batch atau single
        if 'patients' in input_data:
            patients = input_data['patients']
            results = []
            for patient in patients:
                features_array = encode_patient_data(patient, n_features)
                if features_array is None:
                    if 'raw_features' in patient:
                        features_array = np.array([patient['raw_features']])
                    else:
                        results.append({'error': f'Model expects {n_features} features but encoding is not configured.'})
                        continue
                
                scaled_features = scaler.transform(features_array)
                prediction_class = int(classifier.predict(scaled_features)[0])
                
                probability = 50.0
                try:
                    proba = classifier.predict_proba(scaled_features)[0]
                    probability = float(proba[1]) * 100
                except Exception:
                    try:
                        decision = classifier.decision_function(scaled_features)[0]
                        prob_val = 1.0 / (1.0 + np.exp(-decision))
                        probability = float(prob_val) * 100
                    except Exception:
                        probability = 85.0 if prediction_class == 1 else 15.0
                    
                risk_level = 'Positif Heart Disease' if prediction_class == 1 else 'Negatif Heart Disease'
                    
                results.append({
                    'heartDiseaseProbability': round(probability),
                    'riskLevel': risk_level,
                    'predictionClass': prediction_class
                })
            print(json.dumps({'predictions': results}))
        else:
            patient = input_data.get('patient', {})
            features_array = encode_patient_data(patient, n_features)
            
            if features_array is None:
                if 'raw_features' in patient:
                    features_array = np.array([patient['raw_features']])
                else:
                    print(json.dumps({'error': f'Model expects {n_features} features but encoding is not configured.'}))
                    return
            
            scaled_features = scaler.transform(features_array)
            prediction_class = int(classifier.predict(scaled_features)[0])
            
            probability = 50.0
            try:
                proba = classifier.predict_proba(scaled_features)[0]
                probability = float(proba[1]) * 100
            except Exception:
                try:
                    decision = classifier.decision_function(scaled_features)[0]
                    prob_val = 1.0 / (1.0 + np.exp(-decision))
                    probability = float(prob_val) * 100
                except Exception:
                    probability = 85.0 if prediction_class == 1 else 15.0
                
            risk_level = 'Positif Heart Disease' if prediction_class == 1 else 'Negatif Heart Disease'
                
            result = {
                'heartDiseaseProbability': round(probability),
                'riskLevel': risk_level,
                'predictionClass': prediction_class,
                'features_used': features_array.tolist()[0],
                'n_features': n_features
            }
            print(json.dumps(result))
            
    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == '__main__':
    main()
