import React from "react";

export interface ErrorMessageProps {
  message: string | null;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  if (message === null) return null;

  return (
    <div className="ff-error-message" role="alert">
      {message}
    </div>
  );
};
