import React from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiUser, FiCpu, FiClock, FiExternalLink } from 'react-icons/fi';

const MessageContainer = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  margin-bottom: 1rem;
  animation: fadeIn 0.3s ease-in;
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  flex-shrink: 0;
  
  ${props => props.type === 'user' ? `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  ` : `
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  `}
  
  ${props => props.isError && `
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
  `}
`;

const MessageContent = styled.div`
  flex: 1;
  max-width: calc(100% - 60px);
`;

const MessageBubble = styled.div`
  padding: 1rem 1.25rem;
  border-radius: 1rem;
  max-width: 100%;
  word-wrap: break-word;
  
  ${props => props.type === 'user' ? `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    margin-left: auto;
    border-bottom-right-radius: 0.25rem;
  ` : `
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-bottom-left-radius: 0.25rem;
    color: #2d3748;
  `}
  
  ${props => props.isError && `
    background: #fed7d7;
    border-color: #feb2b2;
    color: #c53030;
  `}
`;

const MessageMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
`;

const SourcesList = styled.div`
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: #f1f5f9;
  border-radius: 0.5rem;
  border-left: 3px solid #667eea;
  
  .sources-title {
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }
  
  .source-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: #6b7280;
    font-size: 0.75rem;
    margin-bottom: 0.25rem;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
`;

const StyledMarkdown = styled(ReactMarkdown)`
  line-height: 1.6;
  
  p {
    margin: 0 0 1rem 0;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  h1, h2, h3, h4, h5, h6 {
    margin: 1.5rem 0 0.75rem 0;
    color: ${props => props.type === 'user' ? 'white' : '#1a202c'};
    
    &:first-child {
      margin-top: 0;
    }
  }
  
  ul, ol {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }
  
  li {
    margin: 0.25rem 0;
  }
  
  blockquote {
    border-left: 3px solid ${props => props.type === 'user' ? 'rgba(255,255,255,0.3)' : '#e2e8f0'};
    padding-left: 1rem;
    margin: 1rem 0;
    color: ${props => props.type === 'user' ? 'rgba(255,255,255,0.9)' : '#6b7280'};
  }
  
  code {
    background: ${props => props.type === 'user' ? 'rgba(255,255,255,0.2)' : '#f1f5f9'};
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875em;
    color: ${props => props.type === 'user' ? 'white' : '#d63384'};
  }
  
  pre {
    margin: 1rem 0;
    
    code {
      background: none;
      padding: 0;
      color: inherit;
    }
  }
  
  a {
    color: ${props => props.type === 'user' ? 'rgba(255,255,255,0.9)' : '#667eea'};
    text-decoration: underline;
    
    &:hover {
      text-decoration: none;
    }
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }
  
  th, td {
    padding: 0.5rem;
    border: 1px solid ${props => props.type === 'user' ? 'rgba(255,255,255,0.3)' : '#e2e8f0'};
    text-align: left;
  }
  
  th {
    background: ${props => props.type === 'user' ? 'rgba(255,255,255,0.1)' : '#f8fafc'};
    font-weight: 600;
  }
`;

const MessageBubbleComponent = ({ message }) => {
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={tomorrow}
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: '1rem 0',
            borderRadius: '0.5rem',
            fontSize: '0.875rem'
          }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <MessageContainer>
      <Avatar type={message.type} isError={message.isError}>
        {message.type === 'user' ? <FiUser size={20} /> : <FiCpu size={20} />}
      </Avatar>
      
      <MessageContent>
        <MessageBubble type={message.type} isError={message.isError}>
          {message.type === 'user' ? (
            <div>{message.content}</div>
          ) : (
            <StyledMarkdown 
              type={message.type}
              components={markdownComponents}
            >
              {message.content}
            </StyledMarkdown>
          )}
        </MessageBubble>
        
        {message.sources && message.sources.length > 0 && (
          <SourcesList>
            <div className="sources-title">📚 Sources used:</div>
            {message.sources.map((source, index) => (
              <div key={index} className="source-item">
                <FiExternalLink size={12} />
                <span>{source}</span>
              </div>
            ))}
          </SourcesList>
        )}
        
        <MessageMeta>
          <FiClock size={12} />
          <span>{formatTimestamp(message.timestamp)}</span>
          {message.metadata?.provider && (
            <>
              <span>•</span>
              <span>{message.metadata.provider}</span>
            </>
          )}
        </MessageMeta>
      </MessageContent>
    </MessageContainer>
  );
};

export default MessageBubbleComponent;
