import { Amplify } from "aws-amplify";

// Primary: Official Superblock Production Cognito Pool where superblock.pvt@gmail.com is registered
export const PRIMARY_POOL = {
  userPoolId: import.meta.env.VITE_AWS_USER_POOLS_ID || "ap-south-1_zvqUmSP2y",
  userPoolClientId: import.meta.env.VITE_AWS_USER_POOLS_WEB_CLIENT_ID || "6hrdibr3fdis15rb72qg2erssn",
};

// Secondary / fallback pool
export const SECONDARY_POOL = {
  userPoolId: "ap-south-1_O2viAa5cM",
  userPoolClientId: "4t46u2ot1h9b9d5no9qsnt2fgj",
};

let currentConfig = { ...PRIMARY_POOL };

export function configureAmplifyPool(pool: { userPoolId: string; userPoolClientId: string }) {
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
    currentConfig = { ...pool };
    console.log(`✅ AWS Amplify configured with User Pool: ${pool.userPoolId}`);
  } catch (err) {
    console.warn("Amplify configuration warning:", err);
  }
}

export function initAmplify() {
  configureAmplifyPool(currentConfig);
}

// Auto-initialize on module load
initAmplify();
