import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { FiSend, FiSettings, FiMessageCircle, FiLoader } from 'react-icons/fi';
import MessageBubble from './MessageBubble';
import ProviderSelector from './ProviderSelector';
import { chatAPI } from '../services/api';

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  background: #ffffff;
`;

const Header = styled.header`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }
`;

const HeaderControls = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const SettingsButton = styled.button`
  background: rgba(255,255,255,0.2);
  border: none;
  color: white;
  padding: 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background 0.2s;
  
  &:hover {
    background: rgba(255,255,255,0.3);
  }
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const WelcomeMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: #6b7280;
  
  h2 {
    color: #374151;
    margin-bottom: 1rem;
  }
  
  p {
    margin-bottom: 0.5rem;
  }
  
  .examples {
    margin-top: 1.5rem;
    text-align: left;
    
    h3 {
      color: #374151;
      font-size: 1rem;
      margin-bottom: 0.5rem;
    }
    
    .example {
      background: #f9fafb;
      padding: 0.75rem;
      border-radius: 0.5rem;
      margin-bottom: 0.5rem;
      cursor: pointer;
      transition: background 0.2s;
      
      &:hover {
        background: #f3f4f6;
      }
    }
  }
`;

const InputContainer = styled.div`
  padding: 1rem 2rem 2rem;
  border-top: 1px solid #e5e7eb;
  background: white;
`;

const InputWrapper = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
`;

const InputArea = styled.div`
  flex: 1;
  position: relative;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 60px;
  max-height: 150px;
  padding: 1rem 3rem 1rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 1rem;
  font-family: inherit;
  font-size: 1rem;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
  
  &:focus {
    border-color: #667eea;
  }
  
  &::placeholder {
    color: #9ca3af;
  }
`;

const SendButton = styled.button`
  background: ${props => props.disabled ? '#d1d5db' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  color: white;
  border: none;
  border-radius: 1rem;
  padding: 1rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  min-width: 60px;
  height: 60px;
  
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
`;

const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
  font-style: italic;
  margin-left: 1rem;
  
  .dots {
    display: flex;
    gap: 2px;
    
    span {
      width: 4px;
      height: 4px;
      background: #6b7280;
      border-radius: 50%;
      animation: typing 1.4s ease-in-out infinite;
      
      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.4s; }
    }
  }
  
  @keyframes typing {
    0%, 80%, 100% { opacity: 0.3; }
    40% { opacity: 1; }
  }
`;

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);
  const textAreaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(userMessage.content, {
        provider: selectedProvider || undefined,
        maxContextDocs: 5,
        includeContext: false
      });

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: response.data.response,
        sources: response.data.sources,
        metadata: response.data.metadata,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `I'm sorry, I encountered an error: ${error.message}`,
        isError: true,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleExampleClick = (example) => {
    setInputValue(example);
    textAreaRef.current?.focus();
  };

  const exampleQuestions = [
    "What are the steps to instrument a Node.js application with OpenTelemetry to Honeycomb?",
    "How can I create custom spans in my Node.js application?",
    "How do I configure OpenTelemetry to export traces to Honeycomb?",
    "How can I instrument LangChain with OpenTelemetry on Node.js? to Honeycomb?",
    "How can I instrument React web applications with OpenTelemetry to Honeycomb?",
    "What is the difference between manual and automatic instrumentation in OpenTelemetry?",
  ];

  return (
    <ChatContainer>
      <Header>
        <HeaderTitle>
          <FiMessageCircle size={24} />
          <h1>OpenTelemetry AI Assistant</h1>
        </HeaderTitle>
        <HeaderControls>
          <ProviderSelector 
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
          />
          <SettingsButton onClick={() => setShowSettings(!showSettings)}>
            <FiSettings size={20} />
          </SettingsButton>
        </HeaderControls>
      </Header>

      <MessagesContainer>
        {messages.length === 0 ? (
          <WelcomeMessage>
            <h2>👋 Welcome to your OpenTelemetry AI Assistant!</h2>
            <p>I'm here to help you with OpenTelemetry integration and instrumentation questions.</p>
            <p>Ask me anything about setting up tracing, metrics, or observability in your Node.js applications.</p>
            
            <div className="examples">
              <h3>Try asking me:</h3>
              {exampleQuestions.map((example, index) => (
                <div 
                  key={index}
                  className="example"
                  onClick={() => handleExampleClick(example)}
                >
                  "{example}"
                </div>
              ))}
            </div>
          </WelcomeMessage>
        ) : (
          messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        
        {isLoading && (
          <TypingIndicator>
            <FiLoader className="spinner" />
            <span>Thinking...</span>
            <div className="dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </TypingIndicator>
        )}
        
        <div ref={messagesEndRef} />
      </MessagesContainer>

      <InputContainer>
        <InputWrapper>
          <InputArea>
            <TextArea
              ref={textAreaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about OpenTelemetry integration..."
              disabled={isLoading}
            />
          </InputArea>
          <SendButton 
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
          >
            {isLoading ? <FiLoader className="spinner" /> : <FiSend size={20} />}
          </SendButton>
        </InputWrapper>
      </InputContainer>
    </ChatContainer>
  );
};

export default ChatInterface;
