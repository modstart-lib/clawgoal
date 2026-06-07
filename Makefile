.PHONY: build gen dev dev-seed help install clean

.DEFAULT_GOAL := help

# 是否在启动时自动填充 Demo 数据（仅开发环境且数据库为空时生效）
SEED_DATA_INIT ?=

# 构建所有包
build:
	@echo "🎁 构建所有包..."
	pnpm build
	@echo "✅ 构建完成！"

# 生成开发所需的代码文件（接口文档 / 内置角色等）
gen:
	@echo "⚙️  生成开发所需文件..."
	@echo "1️⃣ 生成 apiDocData.ts（接口文档）..."
	cd packages/backend && bun run scripts/genApiDoc.ts
	@echo "2️⃣ 生成 bundledRoles.ts（内置角色嵌入）..."
	cd packages/backend-claw && bun run scripts/embedRoles.ts
	@echo "✅ 生成完成！"

# 开发模式：启动前端 + 后端（自动先执行 gen）
dev: gen
	@echo "🚀 启动开发模式（前端 + 后端）..."
	@echo "前端: http://localhost:53000"
	@echo "后端: http://localhost:53001"
	mkdir -p packages/backend/data
	SEED_DATA_INIT=$(SEED_DATA_INIT) pnpm dev

# 清理数据库/缓存后启动开发模式（自动填充 Demo 数据，自动先执行 gen）
dev-seed: gen
	@echo "🧹 清理数据库、缓存、日志..."
	rm -rfv packages/backend/data/db
	rm -rfv packages/backend/data/logs
	rm -rfv packages/backend/data/cache
	rm -rfv packages/backend/data/tmp
	@echo "🌱 启动开发模式（自动填充 Demo 数据）..."
	@echo "前端: http://localhost:53000"
	@echo "后端: http://localhost:53001"
	mkdir -p packages/backend/data
	SEED_DATA_INIT=1 pnpm dev

# 安装依赖
install:
	@echo "📦 安装依赖..."
	pnpm install
	@echo "✅ 依赖安装完成！"

# 清理构建产物、生成文件 和 node_modules
clean:
	@echo "🧹 清理构建产物..."
	rm -rf packages/*/dist
	@echo "📄 清理生成文件..."
	rm -rf packages/backend/src/generated
	rm -rf packages/backend-claw/src/generated
	@echo "📦 清理 node_modules..."
	rm -rf node_modules packages/*/node_modules
	@echo "✅ 清理完成！"

# 显示帮助信息
help:
	@echo "ClawGoal Pro Makefile"
	@echo ""
	@echo "用法:"
	@echo "  make build      - 构建所有包"
	@echo "  make gen        - 生成 apiDocData / bundledRoles 等开发所需文件"
	@echo "  make dev        - 生成文件 → 启动开发模式（前端 + 后端）"
	@echo "  make dev-seed   - 生成文件 → 清理数据库 → 启动开发模式（自动填充 Demo 数据）"
	@echo "  make install    - 安装所有依赖"
	@echo "  make clean      - 清理构建产物、生成文件和 node_modules"
	@echo "  make help       - 显示本帮助信息"
	@echo ""
