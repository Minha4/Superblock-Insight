import { Amplify } from "aws-amplify";

// Primary: Official Superblock Production Cognito Pool
export const SUPERBLOCK_COGNITO_POOL = {
  userPoolId: "ap-south-1_zvqUmSP2y",
  userPoolClientId: "6hrdibr3fdis15rb72qg2erssn",
};

// Backwards compatibility aliases
export const PRIMARY_POOL = SUPERBLOCK_COGNITO_POOL;
export const SECONDARY_POOL = SUPERBLOCK_COGNITO_POOL;

let isConfigured = false;

export function configureAmplifyPool(pool: { userPoolId: string; userPoolClientId: string } = SUPERBLOCK_COGNITO_POOL) {
  try {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: pool.userPoolId,
          userPoolClientId: pool.userPoolClientId,
          loginWith: {
            email: true,
            username: true,
          },
        },
      },
    });
    isConfigured = true;
    console.log(`✅ AWS Amplify configured with User Pool: ${pool.userPoolId}`);
  } catch (err) {
    console.warn("Amplify configuration warning:", err);
  }
}

export function initAmplify() {
  if (!isConfigured) {
    configureAmplifyPool(SUPERBLOCK_COGNITO_POOL);
  }
}

// Auto-initialize on module load
initAmplify();
