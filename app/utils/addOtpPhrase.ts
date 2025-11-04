import { getCookie, setCookie } from 'cookies-next';
export function addOtpPhrase(newEntry: any) {
    const existing = getCookie("otpPhrase");
    let otpArray: any[] = [];
  
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        otpArray = Array.isArray(parsed) ? parsed : []; // ✅ ensure it's an array
      } catch (e) {
        otpArray = [];
      }
    }
  
    otpArray.push(newEntry);
  
    setCookie(
      "otpPhrase",
      JSON.stringify(otpArray),
      { maxAge: 60 * 60 * 24 * 7 } // 7 days
    );
  }

  export const handleSelection = async (config: any, consentData: any, conversationId: any, ) => {
      fetch(`${config.api.baseUrl}/links/cookies/${conversationId}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie_selection: consentData }),
      })
        .then((res) => res.json())
        .then((data) => {
            console.log("🚀 ~ handleSelection ~ data:", data)
            // Save to cookie as { conversationId, passphrase }
          
        })
        .catch((e) => {
          console.error("Error sending cookie selection:", e);
        })
          .finally(() => {
        
          });
  };
  