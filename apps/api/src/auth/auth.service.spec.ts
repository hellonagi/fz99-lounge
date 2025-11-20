import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';

/**
 * AuthServiceのテスト
 *
 * このテストファイルでは、Discord認証の核となるAuthServiceをテストします。
 * 特に重要なのは、新規ユーザーの作成と既存ユーザーの更新処理です。
 */
describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // ========================================
  // モックの設定
  // ========================================
  // PrismaServiceのモック
  // 実際のDBアクセスの代わりに、このモックが使われます
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),  // ユーザー検索
      create: jest.fn(),      // ユーザー作成
      update: jest.fn(),      // ユーザー更新
    },
    userStatsGP: {
      create: jest.fn(),      // GPモードの統計作成
    },
    userStatsClassic: {
      create: jest.fn(),      // クラシックモードの統計作成
    },
  };

  // JwtServiceのモック
  const mockJwtService = {
    sign: jest.fn(() => 'test-jwt-token'),
  };

  // ========================================
  // 各テストの前に実行される準備
  // ========================================
  beforeEach(async () => {
    // テストモジュールを作成
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,  // テスト対象のサービス
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    // サービスを取得
    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    // 前のテストの影響を受けないように、モックをリセット
    jest.clearAllMocks();
  });

  // ========================================
  // validateOrCreateUser メソッドのテスト
  // ========================================
  describe('validateOrCreateUser', () => {
    // テスト用のDiscordユーザー情報
    const discordUser = {
      discordId: 'discord-123456',
      username: 'TestUser',
      displayName: 'テストユーザー',
      avatarHash: 'avatar-hash-123',
      email: 'test@example.com',
    };

    /**
     * テスト1: 新規ユーザーの作成
     *
     * シナリオ：
     * 1. Discordから初めてログインするユーザー
     * 2. DBにまだ存在しない
     * 3. 新規作成して、統計情報も初期化する
     */
    it('新規ユーザーを作成し、統計情報も初期化する', async () => {
      // ========== Arrange（準備） ==========
      // DBに作成される予定のユーザーデータ
      const createdUser = {
        id: 'user-1',
        profileId: 1001,
        discordId: discordUser.discordId,
        username: discordUser.username,
        displayName: null,  // 初回登録時はnull（後でモーダルで設定）
        avatarHash: discordUser.avatarHash,
        email: discordUser.email,
        role: UserRole.PLAYER,
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // モックの動作設定
      // 1. findUniqueはnullを返す（ユーザーが存在しない）
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      // 2. createは新規ユーザーを返す
      mockPrismaService.user.create.mockResolvedValue(createdUser);
      // 3. 統計情報の作成も成功する
      mockPrismaService.userStatsGP.create.mockResolvedValue({ id: 'stats99-1', userId: 'user-1' });
      mockPrismaService.userStatsClassic.create.mockResolvedValue({ id: 'statsClassic-1', userId: 'user-1' });

      // ========== Act（実行） ==========
      const result = await service.validateOrCreateUser(discordUser);

      // ========== Assert（検証） ==========
      // 1. ユーザー検索が正しく呼ばれたか
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { discordId: discordUser.discordId },
      });

      // 2. ユーザー作成が正しいデータで呼ばれたか
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          discordId: discordUser.discordId,
          username: discordUser.username,
          displayName: null,  // 重要：初回はnull
          avatarHash: discordUser.avatarHash,
          email: discordUser.email,
          role: UserRole.PLAYER,
          status: UserStatus.ACTIVE,
          lastLoginAt: expect.any(Date),
        },
      });

      // 3. 両方の統計情報が作成されたか
      expect(mockPrismaService.userStatsGP.create).toHaveBeenCalledWith({
        data: { userId: createdUser.id },
      });
      expect(mockPrismaService.userStatsClassic.create).toHaveBeenCalledWith({
        data: { userId: createdUser.id },
      });

      // 4. 正しいユーザーが返されたか
      expect(result).toEqual(createdUser);
    });

    /**
     * テスト2: 既存ユーザーの更新
     *
     * シナリオ：
     * 1. 以前にログインしたことがあるユーザー
     * 2. DBに既に存在する
     * 3. プロフィール情報と最終ログイン時刻を更新
     */
    it('既存ユーザーのプロフィールと最終ログイン時刻を更新する', async () => {
      // ========== Arrange（準備） ==========
      // DBに既に存在するユーザー（古い情報）
      const existingUser = {
        id: 'user-existing',
        profileId: 2001,
        discordId: discordUser.discordId,
        username: 'OldUsername',  // 古いユーザー名
        displayName: '古い表示名',
        avatarHash: 'old-avatar',  // 古いアバター
        email: 'old@example.com',   // 古いメール
        role: UserRole.PLAYER,
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date('2024-01-01'),  // 古いログイン時刻
        createdAt: new Date('2023-12-01'),
        updatedAt: new Date('2024-01-01'),
      };

      // 更新後のユーザー
      const updatedUser = {
        ...existingUser,
        username: discordUser.username,      // 新しいユーザー名
        avatarHash: discordUser.avatarHash,  // 新しいアバター
        email: discordUser.email,            // 新しいメール
        lastLoginAt: new Date(),             // 現在時刻
        updatedAt: new Date(),
      };

      // モックの動作設定
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      // ========== Act（実行） ==========
      const result = await service.validateOrCreateUser(discordUser);

      // ========== Assert（検証） ==========
      // 1. 更新が正しく呼ばれたか
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          username: discordUser.username,
          avatarHash: discordUser.avatarHash,
          email: discordUser.email,
          lastLoginAt: expect.any(Date),
        },
      });

      // 2. 統計情報は作成されないこと（既存ユーザーなので）
      expect(mockPrismaService.userStatsGP.create).not.toHaveBeenCalled();
      expect(mockPrismaService.userStatsClassic.create).not.toHaveBeenCalled();

      // 3. 更新されたユーザーが返されたか
      expect(result).toEqual(updatedUser);
    });
  });
});