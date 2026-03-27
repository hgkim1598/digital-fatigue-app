'use strict';

// Mock AWS SDK clients — use var for jest.mock hoisting compatibility
var mockCognitoSend = jest.fn();
var mockDdbSend = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({ send: mockCognitoSend })),
  SignUpCommand: jest.fn((params) => ({ ...params, _type: 'SignUp' })),
  InitiateAuthCommand: jest.fn((params) => ({ ...params, _type: 'InitiateAuth' })),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDdbSend })) },
  PutCommand: jest.fn((params) => ({ ...params, _type: 'Put' })),
}));

const { handler } = require('../../../src/handlers/auth');

process.env.USER_POOL_CLIENT_ID = 'test-client-id';
process.env.USERS_TABLE = 'Users';
process.env.REGION = 'us-east-1';

const makeEvent = (path, body) => ({
  httpMethod: 'POST',
  path,
  body: JSON.stringify(body),
});

describe('AuthFunction handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCognitoSend.mockResolvedValue({});
    mockDdbSend.mockResolvedValue({});
  });

  // ---- Signup ----
  describe('POST /api/auth/signup', () => {
    const validBody = { email: 'user@example.com', password: 'Pass1234!', age: 25, gender: 'male' };

    it('returns 200 on successful signup', async () => {
      const res = await handler(makeEvent('/api/auth/signup', validBody));
      expect(res.statusCode).toBe(200);
      expect(mockCognitoSend).toHaveBeenCalledTimes(1);
      expect(mockDdbSend).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await handler(makeEvent('/api/auth/signup', { email: 'a@b.com' }));
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('누락');
    });

    it('returns 400 for invalid email', async () => {
      const res = await handler(makeEvent('/api/auth/signup', { ...validBody, email: 'bad' }));
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for non-positive-integer age', async () => {
      const res = await handler(makeEvent('/api/auth/signup', { ...validBody, age: -1 }));
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for invalid gender', async () => {
      const res = await handler(makeEvent('/api/auth/signup', { ...validBody, gender: 'unknown' }));
      expect(res.statusCode).toBe(400);
    });

    it('returns 409 for duplicate email (UsernameExistsException)', async () => {
      const err = new Error('User already exists');
      err.name = 'UsernameExistsException';
      mockCognitoSend.mockRejectedValueOnce(err);

      const res = await handler(makeEvent('/api/auth/signup', validBody));
      expect(res.statusCode).toBe(409);
      expect(mockDdbSend).not.toHaveBeenCalled();
    });

    it('returns 500 on unexpected Cognito error', async () => {
      mockCognitoSend.mockRejectedValueOnce(new Error('Internal'));

      const res = await handler(makeEvent('/api/auth/signup', validBody));
      expect(res.statusCode).toBe(500);
    });
  });

  // ---- Login ----
  describe('POST /api/auth/login', () => {
    const loginBody = { email: 'user@example.com', password: 'Pass1234!' };

    it('returns 200 with tokens on successful login', async () => {
      mockCognitoSend.mockResolvedValueOnce({
        AuthenticationResult: {
          AccessToken: 'access-tok',
          IdToken: 'id-tok',
          RefreshToken: 'refresh-tok',
        },
      });

      const res = await handler(makeEvent('/api/auth/login', loginBody));
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBe('access-tok');
      expect(body.idToken).toBe('id-tok');
      expect(body.refreshToken).toBe('refresh-tok');
    });

    it('returns 400 when email or password missing', async () => {
      const res = await handler(makeEvent('/api/auth/login', { email: 'a@b.com' }));
      expect(res.statusCode).toBe(400);
    });

    it('returns 401 on NotAuthorizedException', async () => {
      const err = new Error('Incorrect');
      err.name = 'NotAuthorizedException';
      mockCognitoSend.mockRejectedValueOnce(err);

      const res = await handler(makeEvent('/api/auth/login', loginBody));
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 on UserNotFoundException', async () => {
      const err = new Error('User not found');
      err.name = 'UserNotFoundException';
      mockCognitoSend.mockRejectedValueOnce(err);

      const res = await handler(makeEvent('/api/auth/login', loginBody));
      expect(res.statusCode).toBe(401);
    });

    it('returns 500 on unexpected Cognito error', async () => {
      mockCognitoSend.mockRejectedValueOnce(new Error('Boom'));

      const res = await handler(makeEvent('/api/auth/login', loginBody));
      expect(res.statusCode).toBe(500);
    });
  });

  // ---- Edge cases ----
  describe('edge cases', () => {
    it('returns 404 for unknown path', async () => {
      const res = await handler(makeEvent('/api/auth/unknown', {}));
      expect(res.statusCode).toBe(404);
    });

    it('response body is always valid JSON', async () => {
      const res = await handler(makeEvent('/api/auth/signup', { email: 'bad' }));
      expect(() => JSON.parse(res.body)).not.toThrow();
    });
  });
});
