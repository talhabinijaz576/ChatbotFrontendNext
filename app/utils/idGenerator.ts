import { ThreadMessageLike } from "@assistant-ui/react";

// Generate a random number between min and max (inclusive)
const getRandomNumber = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  
  // Generate a random user ID (7-8 digits)
  // export const generateUserId = (): string => {
  //   return getRandomNumber(10000000000000000000000000000, 999999999999999999999999999999).toString();
  // };
  export const generateUserId = (length = 24): string => {
    let id = "";
    for (let i = 0; i < length; i++) {
      id += Math.floor(Math.random() * 10).toString(); // Random digit [0-9]
    }
    return id;
  };
  
  
  // Generate a random conversation ID (7-8 digits)
  export const generateConversationId = (): string => {
    return getRandomNumber(1000000, 9999999).toString();
  }; 

export function normalizeMessages(rawMessages: any[]): ThreadMessageLike[] {
    return rawMessages.map((msg, index) => ({
      id: msg.id ?? index,
      role: msg.role,
      content: msg.text || "", // ensure fallback if text is missing
    }));
  }
  