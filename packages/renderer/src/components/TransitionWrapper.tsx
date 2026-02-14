import React from "react";

export interface TransitionWrapperProps {
  phase: "entering" | "active" | "exiting";
  children: React.ReactNode;
}

export const TransitionWrapper: React.FC<TransitionWrapperProps> = ({
  phase,
  children,
}) => {
  return (
    <div className={`ff-transition ff-transition-${phase}`}>{children}</div>
  );
};
