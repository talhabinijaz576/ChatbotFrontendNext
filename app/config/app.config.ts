import { v4 as uuidv4 } from "uuid";

interface ApiConfig {
  baseUrl: string;
  endpoints: {
    conversation: string;
  };
  headers: {
    'Content-Type': string;
    [key: string]: string;
  };
}

interface WebSocketConfig {
  baseUrl: string;
  endpoints: {
    user: string;
  };
  reconnectInterval: number;
}

interface AppConfig {
  api: ApiConfig;
  websocket: WebSocketConfig;
  app: {
    title: string;
    drawerWidth: number;
    disclaimer: string;
  };
  chat?: {
    defaultTitle?: string;
    isDark?: true | false;
    showBotAvatar?: boolean;
    colors?: {
      userMessage: {
        background: string;
        text: string;
      };
      assistantMessage: {
        background: string;
        text: string;
      };
    };
    // Add more display options as needed
  };
}

// Generate IDs for this session
const userId = uuidv4();

const config: AppConfig = {
  api: {
    baseUrl: 'https://leadgen-chatbot-v1.jazeeautomation.com',
    endpoints: {
      conversation: `/conversation/${userId}/message`,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  },
  websocket: {
    baseUrl: `wss://leadgen-chatbot-v1.jazeeautomation.com/`,
    endpoints: {
      user: `ws/user/${userId}/`
    },
    reconnectInterval: 5000, // 5 seconds
  },
  app: {
    title: 'Jazee AI Assistant',
    drawerWidth: 280,
    disclaimer: 'A personalized AI chat app powered by Jazee that remembers your preferences, facts, and memories.',
  },
  chat: {
    defaultTitle: "My Custom Title",
    isDark: false, // or "light"
    showBotAvatar: true,
    colors: {
      userMessage: {
        background: "rgb(79, 70, 229)",
        text: "rgb(247, 246, 255)",
      },
      assistantMessage: {
        background: "#F1F0F0",
        text: "#000000",
      },
    }
    // Add more options as needed
  }
};

export default config; 
