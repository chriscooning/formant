import React from "react";

export interface ProgressBarProps {
  progress: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  return (
    <div className="ff-progress">
      <div
        className="ff-progress-bar"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
