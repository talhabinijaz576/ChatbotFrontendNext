"use client";
import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Modal,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Stack,
  Alert,
} from "@mui/material";
import { getCookie, setCookie } from "cookies-next";
import { addOtpPhrase } from "@/app/utils/addOtpPhrase";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

export const OtpModal = ({ open, onOtpSuccess, conversationId, config }) => {
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const inputsRef = useRef([]);

  // Send OTP when modal opens
  useEffect(() => {
    if (open && conversationId) {
      setLoading(true);
      fetch(`${config.api.baseUrl}/conversation/${conversationId}/otp/send`, {
        method: "POST",
        headers: config.api.headers,
      })
        .then((res) => res.json())
        .then((data) => {
          const phone = data.phone || "";
          setPhone(phone);
        })
        .catch(() => setError("Failed to send OTP"))
        .finally(() => setLoading(false));
    }
  }, [open, conversationId]);

  const handleChange = (value, index) => {
    if (/^[0-9]?$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      setError("");

      // Move to next input automatically
      if (value && index < 5) {
        inputsRef.current[index + 1].focus();
      }
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };
  // Handle OTP validation
  const handleValidate = () => {
    setCookie(
      "otpPhrase",
      JSON.stringify({
        conversationId: 12212323123,
        passphrase: "fddfdffdffff",
      }),
      { maxAge: 60 * 60 * 24 * 7 }
    );
    const otpCode = otp.join("");
    if (otpCode.length !== 4) {
      setError("Please enter the complete 4-digit OTP.");
      return;
    }
    setLoading(true);
    fetch(`${config.api.baseUrl}/conversation/${conversationId}/otp/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp: otpCode }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.passphrase) {
          // Save to cookie as { conversationId, passphrase }
          addOtpPhrase({
            conversationId,
            passphrase: data.passphrase,
          });
          onOtpSuccess();
        } else {
          setError("Invalid OTP");
        }
      })
      .catch((e) => {
        setError("Error validating OTP")
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      open={open}
      disableEscapeKeyDown={loading}
    >
      <Box sx={style}>
        <Typography variant="h6" textAlign="center" fontWeight="bold">
          OTP Verification
        </Typography>

        {phone && (
          <Typography
            variant="body2"
            textAlign="center"
            sx={{ mt: 1, color: "text.secondary" }}
          >
            OTP has been sent to <b>{phone}</b>
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {/* OTP Input Boxes */}
        <Stack
          direction="row"
          spacing={1.5}
          justifyContent="center"
        >
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              value={digit}
              onChange={(e) => handleChange(e.target.value, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              maxLength={1}
              style={{
                width: "45px",
                height: "50px",
                textAlign: "center",
                fontSize: "20px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                outline: "none",
              }}
            />
          ))}
        </Stack>
        <Stack
          direction="row"
          spacing={1.5}
          justifyContent="center"
          sx={{ mt: 3 }}
        >
        <Button
          
          variant="contained"
          sx={{ mt: 3, height: "45px" }}
          onClick={handleValidate}
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            "Verify OTP"
          )}
        </Button>
        </Stack>
      </Box>
    </Modal>
  );
};
