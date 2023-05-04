import React from 'react';

interface ConditionalWrapperProps {
  children: React.ReactNode;
  condition: boolean;
  Wrapper: React.FC<{ children: React.ReactNode }>;
}

const ConditionalWrapper = ({ condition, Wrapper, children }: ConditionalWrapperProps) => {
  return condition ? <Wrapper>{children}</Wrapper> : <>{children}</>;
};

export default ConditionalWrapper;
