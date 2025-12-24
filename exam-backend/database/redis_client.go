package database

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

var redisClient *redis.Client

// InitializeRedis MUST succeed or app should exit
func InitializeRedis(addr string) error {
	redisClient = redis.NewClient(&redis.Options{
		Addr:         addr,
		DB:           0,
		PoolSize:     50,               // IMPORTANT for 2000 students
		MinIdleConns: 10,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := redisClient.Ping(ctx).Result(); err != nil {
		return fmt.Errorf("redis ping failed: %w", err)
	}

	return nil
}

// -------------------- CORE HELPERS --------------------

func RedisSet(ctx context.Context, key string, val string, ttl time.Duration) error {
	ensureRedis()
	return redisClient.Set(ctx, key, val, ttl).Err()
}

func RedisGet(ctx context.Context, key string) (string, error) {
	ensureRedis()
	return redisClient.Get(ctx, key).Result()
}

func RedisDel(ctx context.Context, key string) error {
	ensureRedis()
	return redisClient.Del(ctx, key).Err()
}

// -------------------- ATOMIC HELPERS --------------------

// RedisIncr increments a key atomically
func RedisIncr(ctx context.Context, key string) (int64, error) {
	ensureRedis()
	return redisClient.Incr(ctx, key).Result()
}

// RedisExpire sets TTL
func RedisExpire(ctx context.Context, key string, ttl time.Duration) error {
	ensureRedis()
	return redisClient.Expire(ctx, key, ttl).Err()
}

// -------------------- HEALTH --------------------

func RedisHealthCheck(ctx context.Context) error {
	ensureRedis()
	_, err := redisClient.Ping(ctx).Result()
	return err
}

// -------------------- SAFETY --------------------

func ensureRedis() {
	if redisClient == nil {
		panic(errors.New("redis client is NOT initialized (this is fatal in production)"))
	}
}
