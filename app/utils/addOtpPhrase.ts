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
  