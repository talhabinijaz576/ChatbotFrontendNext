import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
interface IframeDisplayProps {
    showIframe: boolean;
    iframeUrl: string | null;
  }
  
  const IframeDisplay: React.FC<IframeDisplayProps> = ({ showIframe, iframeUrl }) => {
    if (!showIframe || !iframeUrl) return null;
  
    return (
      <Paper sx={{ 
        width: '50%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderLeft: '1px solid #e2e8f0',
        boxShadow: 'none',
      }}>
        <Box sx={{ 
          p: 3, 
          borderBottom: '1px solid #e2e8f0',
          bgcolor: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ 
              fontWeight: 700,
              color: '#1e293b',
              fontSize: '1rem',
              mb: 1,
            }}>
              External Content
            </Typography>
            <Typography variant="caption" sx={{ 
              color: '#64748b',
              wordBreak: 'break-all',
              fontSize: '0.75rem',
              bgcolor: '#f1f5f9',
              p: 1,
              borderRadius: 1,
              display: 'block',
              fontFamily: 'monospace',
            }}>
              {iframeUrl}
            </Typography>
          </Box>
          <Box sx={{ 
            ml: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: '#64748b',
            fontSize: '0.75rem',
            fontWeight: 500,
          }}>
            <Box sx={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              bgcolor: '#10b981',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }} />
            Live
          </Box>
        </Box>
        <Box sx={{ 
          flexGrow: 1,
          position: 'relative',
          bgcolor: '#ffffff',
        }}>
          <iframe
            src={iframeUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            title="External Content"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </Box>
      </Paper>
    );
  };
  
  export default IframeDisplay; 