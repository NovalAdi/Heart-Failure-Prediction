import sys
import os
import json
import joblib
import pandas as pd
import numpy as np

def encode_patient_data(patient, encoder, n_features):
    # 11 fitur: Age, Sex, ChestPainType, RestingBP, Cholesterol, FastingBS, RestingECG, MaxHR, ExerciseAngina, Oldpeak, ST_Slope
    
    # Dapatkan nilai string asli untuk kolom kategorikal
    sex = patient.get('sex', 'M')
    chest_pain = patient.get('chestPainType', 'ASY')
    resting_ecg = patient.get('restingECG', 'Normal')
    exercise_angina = patient.get('exerciseAngina', 'N')
    st_slope = patient.get('stSlope', 'Flat')

    # Encode menggunakan OrdinalEncoder yang dimuat
    cat_features = np.array([[sex, chest_pain, resting_ecg, exercise_angina, st_slope]])
    encoded_cats = encoder.transform(cat_features)[0]

    sex_val = float(encoded_cats[0])
    cp_val = float(encoded_cats[1])
    ecg_val = float(encoded_cats[2])
    ex_val = float(encoded_cats[3])
    slope_val = float(encoded_cats[4])
    
    if n_features == 11:
        # Standard Heart Failure dataset features
        features = [
            float(patient.get('age', 55)),
            sex_val,
            cp_val,
            float(patient.get('restingBP', 120)),
            float(patient.get('cholesterol', 200)),
            float(patient.get('fastingBS', 0)),
            ecg_val,
            float(patient.get('maxHR', 140)),
            ex_val,
            float(patient.get('oldpeak', 0.0)),
            slope_val
        ]
        return np.array([features])
    else:
        return None

def main():
    try:
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument('--model', type=str, default='svm', choices=['svm', 'dt', 'knn', 'nn'])
        args, unknown = parser.parse_known_args()

        # Ambil input JSON dari Node.js (stdin)
        input_data = json.loads(sys.stdin.read())
        
        # Cari lokasi model, scaler, dan encoder
        dir_path = os.path.dirname(os.path.realpath(__file__))
        model_dir = os.path.join(dir_path, 'models')
        
        if not os.path.exists(model_dir):
            print(json.dumps({'error': f'Models folder not found at: {model_dir}'}))
            return

        model_filenames = {
            'svm': 'heartf_svm.sav',
            'dt': 'heartf_dt.sav',
            'knn': 'heartf_knn.sav',
            'nn': 'heartf_nn.sav'
        }
        model_file = model_filenames.get(args.model, 'heartf_svm.sav')
        
        model_path = os.path.join(model_dir, model_file)
        scaler_path = os.path.join(model_dir, 'scaler_heartf.sav')
        encoder_path = os.path.join(model_dir, 'encoder_heartf.sav')
        
        if not os.path.exists(model_path):
            print(json.dumps({'error': f'Model file {model_file} not found in {model_dir}'}))
            return

        if not os.path.exists(scaler_path):
            print(json.dumps({'error': f'Scaler file scaler_heartf.sav not found in {model_dir}'}))
            return

        if not os.path.exists(encoder_path):
            print(json.dumps({'error': f'Encoder file encoder_heartf.sav not found in {model_dir}'}))
            return

        # Load model, scaler, dan encoder
        classifier = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
        encoder = joblib.load(encoder_path)
        
        # Dynamic fitting jika encoder belum di-fit
        if not hasattr(encoder, 'categories_') or len(encoder.categories_) == 0:
            encoder.categories = [
                ['F', 'M'],
                ['ASY', 'ATA', 'NAP', 'TA'],
                ['LVH', 'Normal', 'ST'],
                ['N', 'Y'],
                ['Down', 'Flat', 'Up']
            ]
            encoder.fit([['F', 'ASY', 'Normal', 'N', 'Flat']])
            
        # Dapatkan jumlah fitur yang diharapkan
        n_features = 11
        if hasattr(scaler, 'n_features_in_'):
            n_features = scaler.n_features_in_
            
        # Periksa apakah request berupa batch atau single
        if 'patients' in input_data:
            patients = input_data['patients']
            results = []
            for patient in patients:
                features_array = encode_patient_data(patient, encoder, n_features)
                if features_array is None:
                    if 'raw_features' in patient:
                        features_array = np.array([patient['raw_features']])
                    else:
                        results.append({'error': f'Model expects {n_features} features but encoding is not configured.'})
                        continue
                
                scaled_features = scaler.transform(features_array)
                prediction_class = int(classifier.predict(scaled_features)[0])
                
                try:
                    proba = classifier.predict_proba(scaled_features)[0]
                    probability = float(proba[1]) * 100
                except Exception:
                    decision = classifier.decision_function(scaled_features)[0]
                    prob_val = 1.0 / (1.0 + np.exp(-decision))
                    probability = float(prob_val) * 100
                    
                risk_level = 'Positif Heart Disease' if prediction_class == 1 else 'Negatif Heart Disease'
                    
                results.append({
                    'heartDiseaseProbability': round(probability),
                    'riskLevel': risk_level,
                    'predictionClass': prediction_class
                })
            print(json.dumps({'predictions': results}))
        else:
            patient = input_data.get('patient', {})
            features_array = encode_patient_data(patient, encoder, n_features)
            
            if features_array is None:
                if 'raw_features' in patient:
                    features_array = np.array([patient['raw_features']])
                else:
                    print(json.dumps({'error': f'Model expects {n_features} features but encoding is not configured.'}))
                    return
            
            scaled_features = scaler.transform(features_array)
            prediction_class = int(classifier.predict(scaled_features)[0])
            
            try:
                proba = classifier.predict_proba(scaled_features)[0]
                probability = float(proba[1]) * 100
            except Exception:
                decision = classifier.decision_function(scaled_features)[0]
                prob_val = 1.0 / (1.0 + np.exp(-decision))
                probability = float(prob_val) * 100
                
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
