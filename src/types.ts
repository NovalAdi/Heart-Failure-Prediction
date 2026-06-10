export interface PatientRecord {
  id: string;
  name: string; // friendly name or ID assigned (e.g., Patient #1)
  age: number;
  sex: 'M' | 'F';
  chestPainType: 'TA' | 'ATA' | 'NAP' | 'ASY';
  restingBP: number;          // mm Hg
  cholesterol: number;        // mm/dl
  fastingBS: 0 | 1;          // 1 if > 120 mg/dl, 0 otherwise
  restingECG: 'Normal' | 'ST' | 'LVH';
  maxHR: number;              // beats per minute [60 - 202]
  exerciseAngina: 'Y' | 'N';
  oldpeak: number;            // depression value
  stSlope: 'Up' | 'Flat' | 'Down';
  // Target output
  prediction?: PredictionResult;
}

export interface PredictionResult {
  heartDiseaseProbability: number; // 0 to 100
  riskLevel: 'Positif Heart Disease' | 'Negatif Heart Disease';
  riskFactors: {
    factor: string;
    impact: 'High' | 'Medium' | 'Low';
    description: string;
  }[];
  indicators: {
    name: string;
    value: string | number;
    status: 'normal' | 'warning' | 'critical';
    message: string;
  }[];
  clinicalInterpretation?: string;
  recommendations?: string[];
}

export interface BatchAnalysisSummary {
  totalCount: number;
  diseaseCount: number;
  normalCount: number;
  averageAge: number;
  riskDistribution: {
    'Positif Heart Disease': number;
    'Negatif Heart Disease': number;
  };
  genderDistribution: {
    M: number;
    F: number;
    diseaseM: number;
    diseaseF: number;
  };
  chestPainDistribution: {
    TA: number;
    ATA: number;
    NAP: number;
    ASY: number;
  };
  stSlopeDistribution: {
    Up: number;
    Flat: number;
    Down: number;
  };
}
