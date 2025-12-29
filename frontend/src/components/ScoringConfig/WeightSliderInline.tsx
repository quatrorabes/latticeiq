import React from 'react';

interface WeightSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export const WeightSlider: React.FC<WeightSliderProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  description,
}) => {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {label}
        </label>
        <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
      />
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {description}
        </p>
      )}
    </div>
  );
};
