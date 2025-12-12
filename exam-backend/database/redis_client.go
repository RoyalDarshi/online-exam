package database

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

var redisClient *redis.Client

// InitializeRedis should be called at startup (in main) with proper options.
func InitializeRedis(addr string) error {
	redisClient = redis.NewClient(&redis.Options{
		Addr: addr,
		// Password: "", // set if needed
		DB: 0,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := redisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("redis ping failed: %w", err)
	}
	return nil
}

func RedisSet(ctx context.Context, key string, val string, ttl time.Duration) error {
	if redisClient == nil {
		// Redis not initialized -> return nil (best-effort)
		return nil
	}
	return redisClient.Set(ctx, key, val, ttl).Err()
}
func RedisGet(ctx context.Context, key string) (string, error) {
	if redisClient == nil {
		return "", nil
	}
	return redisClient.Get(ctx, key).Result()
}
func RedisDel(ctx context.Context, key string) error {
	if redisClient == nil {
		return nil
	}
	_, err := redisClient.Del(ctx, key).Result()
	return err
}
