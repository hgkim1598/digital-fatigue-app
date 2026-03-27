'use strict';

const fc = require('fast-check');

// Mock AWS SDK clients — use var for jest.mock hoisting compatibility
var mockCognitoSend = jest.fn();
var mockDdbSend = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({ send: mockCognitoSend })),
  SignUpCommand: jest.fn((params) => params),
  InitiateAuthCommand: jest.fn((params) => params),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDdbSend })) },
  PutCommand: jest.fn((params) => params),
}));

const { handler } = require('../../src/handlers/auth');

process.env.USER_POOL_CLIENT_ID = 'test-client-id';
process.env.USERS_TABLE = 'Users';
process.env.REGION = 'us-east-1';

const makeEvent = (path, body) => ({
  httpMethod: 'POST',
  path,
  body: JSON.stringify(body),
});

// Arbitraries
const validEmailArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 }),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 8 }),
  fc.constantFrom('com', 'net', 'org', 'co.kr')
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

const validAgeArb = fc.integer({ min: 1, max: 120 });
const validGenderArb = fc.constantFrom('male', 'female', 'other');
const validPasswordArb = fc.string({ minLength: 8, maxLength: 20 });

describe('Auth Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCognitoSend.mockResolvedValue({});
    mockDdbSend.mockResolvedValue({});
  });

  // Property 1: 유효한 회원가입 입력은 항상 성공한다
  it('Property 1: valid signup inputs always succeed', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmailArb,
        validPasswordArb,
        validAgeArb,
        validGenderArb,
        async (email, password, age, gender) => {
          mockCognitoSend.mockResolvedValue({});
          mockDdbSend.mockResolvedValue({});

          const res = await handler(
            makeEvent('/api/auth/signup', { email, password, age, gender })
          );
          expect(res.statusCode).toBe(200);
          expect(() => JSON.parse(res.body)).not.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property 2: 유효하지 않은 회원가입 입력은 항상 거부된다
  describe('Property 2: invalid signup inputs are always rejected', () => {
    it('invalid email is rejected', async () => {
      const invalidEmailArb = fc.constantFrom('', 'noatsign', '@nodomain', 'user@', 'a b@c.com');

      await fc.assert(
        fc.asyncProperty(
          invalidEmailArb,
          validPasswordArb,
          validAgeArb,
          validGenderArb,
          async (email, password, age, gender) => {
            const res = await handler(
              makeEvent('/api/auth/signup', { email, password, age, gender })
            );
            expect(res.statusCode).toBe(400);
            expect(mockCognitoSend).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('invalid age is rejected', async () => {
      const invalidAgeArb = fc.oneof(
        fc.constant(0),
        fc.constant(-5),
        fc.constant(1.5),
        fc.constant('twenty'),
        fc.constant(null)
      );

      await fc.assert(
        fc.asyncProperty(
          validEmailArb,
          validPasswordArb,
          invalidAgeArb,
          validGenderArb,
          async (email, password, age, gender) => {
            const res = await handler(
              makeEvent('/api/auth/signup', { email, password, age, gender })
            );
            expect(res.statusCode).toBe(400);
            expect(mockCognitoSend).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('invalid gender is rejected', async () => {
      const invalidGenderArb = fc.constantFrom('Male', 'FEMALE', '', 'unknown', 'x');

      await fc.assert(
        fc.asyncProperty(
          validEmailArb,
          validPasswordArb,
          validAgeArb,
          invalidGenderArb,
          async (email, password, age, gender) => {
            const res = await handler(
              makeEvent('/api/auth/signup', { email, password, age, gender })
            );
            expect(res.statusCode).toBe(400);
            expect(mockCognitoSend).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
