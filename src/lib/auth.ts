import { NextAuthOptions } from 'next-auth';
import { OAuthConfig } from 'next-auth/providers/oauth';

// Shortcut profile type
interface ShortcutProfile {
  id: string;
  profile: {
    email_address: string;
    name: string;
  };
}

// Linear profile type
interface LinearProfile {
  id: string;
  email: string;
  name: string;
}

// Custom OAuth provider for Shortcut
const ShortcutProvider: OAuthConfig<ShortcutProfile> = {
  id: 'shortcut',
  name: 'Shortcut',
  type: 'oauth',
  authorization: {
    url: 'https://app.shortcut.com/oauth/authorize',
    params: { scope: 'read write' },
  },
  token: 'https://app.shortcut.com/oauth/token',
  userinfo: 'https://api.app.shortcut.com/api/v3/member',
  clientId: process.env.SHORTCUT_CLIENT_ID,
  clientSecret: process.env.SHORTCUT_CLIENT_SECRET,
  profile(profile) {
    return {
      id: profile.id,
      email: profile.profile.email_address,
      name: profile.profile.name,
    };
  },
};

// Custom OAuth provider for Linear
const LinearProvider: OAuthConfig<LinearProfile> = {
  id: 'linear',
  name: 'Linear',
  type: 'oauth',
  authorization: {
    url: 'https://linear.app/oauth/authorize',
    params: { scope: 'read write' },
  },
  token: 'https://api.linear.app/oauth/token',
  userinfo: {
    url: 'https://api.linear.app/graphql',
    async request(context) {
      const accessToken = context.tokens.access_token;
      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: `{ viewer { id name email } }`,
        }),
      });
      const data = await response.json();
      return data.data.viewer;
    },
  },
  clientId: process.env.LINEAR_CLIENT_ID,
  clientSecret: process.env.LINEAR_CLIENT_SECRET,
  profile(profile) {
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
    };
  },
};

export const authOptions: NextAuthOptions = {
  providers: [ShortcutProvider, LinearProvider],
  callbacks: {
    async jwt({ token, account, user }) {
      // Save the access token to the JWT on initial sign in
      if (account && user) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Pass the access token to the session
      return {
        ...session,
        accessToken: token.accessToken,
        provider: token.provider,
        userId: token.userId,
      };
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
