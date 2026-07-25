export interface PaymentRefs {
  square?: {
    plan_id: string;
    var_1: string;
    var_2: string;
    var_3plus: string;
  };
}

export interface SquareEnv {
  SQUARE_ACCESS_TOKEN: string;
  SQUARE_APP_ID: string;
  SQUARE_LOCATION_ID: string;
  ENVIRONMENT?: string;
}

export interface MaktabConfig {
  SQUARE_ACCESS_TOKEN?: string;
  SQUARE_APP_ID?: string;
  SQUARE_LOCATION_ID?: string;
  BREVO_API_KEY?: string;
  SENDER_EMAIL?: string;
  SENDER_NAME?: string;
  FORWARD_TO_EMAIL?: string;
  LOGGING_EMAIL?: string;
  BOT_NAME?: string;
  ENVIRONMENT?: string;
}
