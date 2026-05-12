import React from 'react';
import styled from 'styled-components';
import { FiCpu, FiDatabase } from 'react-icons/fi';

const InfoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.2);
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  backdrop-filter: blur(10px);
`;

const ModelInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .icon {
    opacity: 0.9;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .label {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.8;
    font-weight: 600;
  }

  .model-name {
    font-size: 0.875rem;
    font-weight: 500;
    opacity: 1;
  }
`;

const Divider = styled.div`
  width: 1px;
  height: 32px;
  background: rgba(255,255,255,0.2);
`;

const BedrockInfo = () => {
  return (
    <InfoContainer>
      <ModelInfo>
        <FiCpu size={20} className="icon" />
        <div className="details">
          <div className="label">LLM Model</div>
          <div className="model-name">Claude 3.5 Sonnet</div>
        </div>
      </ModelInfo>

      <Divider />

      <ModelInfo>
        <FiDatabase size={18} className="icon" />
        <div className="details">
          <div className="label">Embeddings</div>
          <div className="model-name">Amazon Titan</div>
        </div>
      </ModelInfo>
    </InfoContainer>
  );
};

export default BedrockInfo;
