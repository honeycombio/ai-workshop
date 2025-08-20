import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FiChevronDown, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { chatAPI } from '../services/api';

const SelectorContainer = styled.div`
  position: relative;
`;

const SelectorButton = styled.button`
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  transition: all 0.2s;
  min-width: 140px;
  justify-content: space-between;
  
  &:hover {
    background: rgba(255,255,255,0.3);
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(255,255,255,0.5);
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  z-index: 1000;
  min-width: 200px;
  margin-top: 0.25rem;
  overflow: hidden;
  
  ${props => !props.isOpen && 'display: none;'}
`;

const DropdownHeader = styled.div`
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
`;

const ProviderOption = styled.div`
  padding: 0.75rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background 0.2s;
  border-bottom: 1px solid #f1f5f9;
  
  &:hover {
    background: #f8fafc;
  }
  
  &:last-child {
    border-bottom: none;
  }
  
  .provider-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  
  .provider-name {
    font-weight: 500;
    color: #374151;
    text-transform: capitalize;
  }
  
  .provider-status {
    font-size: 0.75rem;
    color: #6b7280;
  }
  
  .check-icon {
    color: #10b981;
  }
`;

const LoadingState = styled.div`
  padding: 1rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
`;

const ErrorState = styled.div`
  padding: 1rem;
  text-align: center;
  color: #ef4444;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const ProviderSelector = ({ selectedProvider, onProviderChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await chatAPI.getProviders();
      setProviders(response.data.providers || []);
      
      // Set default provider if none selected
      if (!selectedProvider && response.data.default) {
        onProviderChange(response.data.default);
      }
      
    } catch (err) {
      setError('Failed to load providers');
      console.error('Error loading providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (provider) => {
    onProviderChange(provider);
    setIsOpen(false);
  };

  const getProviderDisplayName = (provider) => {
    const names = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      bedrock: 'AWS Bedrock'
    };
    return names[provider] || provider;
  };

  const getProviderDescription = (provider) => {
    const descriptions = {
      openai: 'GPT-4 and GPT-3.5 models',
      anthropic: 'Claude 3 models',
      bedrock: 'AWS managed AI models'
    };
    return descriptions[provider] || 'AI language model';
  };

  const displayProvider = selectedProvider || 'Select Provider';

  return (
    <SelectorContainer>
      <SelectorButton onClick={() => setIsOpen(!isOpen)}>
        <span>{getProviderDisplayName(displayProvider)}</span>
        <FiChevronDown size={16} style={{ 
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }} />
      </SelectorButton>
      
      <DropdownMenu isOpen={isOpen}>
        <DropdownHeader>
          AI Provider Selection
        </DropdownHeader>
        
        {loading && (
          <LoadingState>
            Loading providers...
          </LoadingState>
        )}
        
        {error && (
          <ErrorState>
            <FiAlertCircle size={16} />
            {error}
          </ErrorState>
        )}
        
        {!loading && !error && providers.length === 0 && (
          <ErrorState>
            <FiAlertCircle size={16} />
            No providers available
          </ErrorState>
        )}
        
        {!loading && !error && providers.map((provider) => (
          <ProviderOption
            key={provider}
            onClick={() => handleProviderSelect(provider)}
          >
            <div className="provider-info">
              <div className="provider-name">
                {getProviderDisplayName(provider)}
              </div>
              <div className="provider-status">
                {getProviderDescription(provider)}
              </div>
            </div>
            {selectedProvider === provider && (
              <FiCheck size={16} className="check-icon" />
            )}
          </ProviderOption>
        ))}
      </DropdownMenu>
      
      {/* Click outside to close */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </SelectorContainer>
  );
};

export default ProviderSelector;
