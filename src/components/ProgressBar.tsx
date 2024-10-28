import React from 'react';

interface Step {
  name: string;
  status: 'upcoming' | 'current' | 'completed';
}

interface ProgressBarProps {
  steps: Step[];
  currentStep: number;
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ steps, currentStep, progress }) => {
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-2">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step.status === 'completed' ? 'bg-green-500' :
              step.status === 'current' ? 'bg-blue-500' : 'bg-gray-300'
            } text-white font-bold`}>
              {index + 1}
            </div>
            <div className="text-xs mt-1">{step.name}</div>
          </div>
        ))}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${progress}%`}}></div>
      </div>
      <p className="text-center mt-2">{progress}% Complete</p>
    </div>
  );
};

export default ProgressBar;
