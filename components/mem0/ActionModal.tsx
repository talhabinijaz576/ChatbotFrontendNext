import React from "react";
import {
  Box,
  Typography,
  IconButton,
  Modal,
  Fade,
  Button,
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Image from "next/image";

interface ActionModalProps {
  config: any;
  open: boolean;
  url: string | null;
  iframeError: boolean;
  onClose: () => void;
  onIframeError: () => void;
  onIframeLoad: () => void;
}

const ActionModal: React.FC<ActionModalProps> = ({
  config,
  open,
  url,
  iframeError,
  onClose,
  onIframeError,
  onIframeLoad,
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      BackdropProps={{ style: { backgroundColor: "transparent" } }} // or disable backdrop entirely
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      keepMounted
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        sx={{
          width: "90vw",
          height: "90vh",
          bgcolor: "#ffffff",
          borderRadius: 3,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Modal Header */}
        <Box
          className="bg-blue-950"
          sx={{
            p: 1,
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: "#e2e8f0",
              fontSize: "1.125rem",
            }}
          >
            <Image
              src={config?.app?.extenalModalLogo}
              alt="Jazee.ai"
              width={120}
              height={30}
            />
          </Typography>
          
        </Box>

        {/* Modal Content - iFrame */}
        <Box sx={{ flexGrow: 1, position: "relative" }}>
          {url && (
            <Box sx={{ width: "100%", height: "100%" }}>
              {!iframeError ? (
                <iframe
                  src={url}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                  }}
                  title="External Content Modal"
                  onError={onIframeError}
                  onLoad={onIframeLoad}
                />
              ) : (
                /* Fallback message for iframe loading issues */
                <Box
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                    bgcolor: "rgba(255, 255, 255, 0.98)",
                    p: 4,
                    borderRadius: 3,
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                    maxWidth: "450px",
                    width: "90%",
                    border: "1px solid #e2e8f0",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <Box
                    sx={{
                      mb: 3,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        bgcolor: "#fef3c7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#d97706",
                      }}
                    >
                      <OpenInNewIcon sx={{ fontSize: 30 }} />
                    </Box>
                  </Box>
                  <Typography
                    variant="h5"
                    sx={{
                      mb: 2,
                      color: "#1e293b",
                      fontWeight: 700,
                    }}
                  >
                    Content Cannot Be Displayed
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      mb: 4,
                      color: "#64748b",
                      lineHeight: 1.6,
                      fontSize: "0.9375rem",
                    }}
                  >
                    This content cannot be displayed in the frame due to
                    security restrictions (X-Frame-Options: deny).
                  </Typography>
                  <Box
                    sx={{ display: "flex", gap: 2, justifyContent: "center" }}
                  >
                    <Button
                      variant="contained"
                      onClick={() => window.open(url, "_blank")}
                      startIcon={<OpenInNewIcon />}
                      sx={{
                        minWidth: "140px",
                        bgcolor: "#3b82f6",
                        color: "white",
                        borderRadius: 2,
                        py: 1.5,
                        fontWeight: 600,
                        textTransform: "none",
                        "&:hover": {
                          bgcolor: "#2563eb",
                        },
                      }}
                    >
                      Open in New Tab
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={onClose}
                      sx={{
                        minWidth: "100px",
                        borderRadius: 2,
                        py: 1.5,
                        fontWeight: 600,
                        textTransform: "none",
                        borderColor: "#e2e8f0",
                        color: "#64748b",
                        "&:hover": {
                          borderColor: "#cbd5e1",
                          bgcolor: "#f8fafc",
                        },
                      }}
                    >
                      Close
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Paper>
    </Modal>
  );
};

export default ActionModal;
