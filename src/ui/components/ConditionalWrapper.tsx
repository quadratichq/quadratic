import React from 'react';

interface ConditionalWrapperProps {
  children: React.ReactNode;
  condition: boolean;
  // TODO need help with type stuff here
  wrapper: React.FC<{ children: React.ReactNode }>;
}

const ConditionalWrapper: React.FC<ConditionalWrapperProps> = ({ condition, wrapper: Wrapper, children }) => {
  return condition ? <Wrapper>{children}</Wrapper> : <>{children}</>;
};

export default ConditionalWrapper;
