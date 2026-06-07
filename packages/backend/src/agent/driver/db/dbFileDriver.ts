/**
 * File DB driver
 * Implements IFileDriver based on filesystem + Prisma
 * Responsible for managing task-related file reading, searching, writing and syncing
 */
import fs from 'fs/promises'
import path from 'path'
import { agentTaskDb } from '../../../storage/store/agentTask.js'
import { logger } from '../../../utils/logger.js'
import type { AgentExecutor } from '../../agentExecutor.js'
import { AbstractFileDriver } from '../fileDriver.js'

export class DbFileDriver extends AbstractFileDriver {
  private fileDir: string

  constructor(executor: AgentExecutor) {
    super(executor)

    this.fileDir = path.join(executor.dir, 'file')

    this.ensureTaskDirectory()
  }

  /**
   * Ensure the task directory exists
   */
  private async ensureTaskDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.fileDir, { recursive: true })
      logger.info(
        { taskId: this.executor.taskId, path: this.fileDir },
        'task_directory_ensured'
      )
    } catch (error) {
      logger.error(
        { taskId: this.executor.taskId, path: this.fileDir, error },
        'task_directory_create_error'
      )
    }
  }

  /**
   * Read a file (supports reading by line range)
   */
  async read(
    filename: string,
    options?: { startLine?: number; endLine?: number }
  ): Promise<string> {
    try {
      const filePath = await this.ensureFileInCache(filename)
      const content = await fs.readFile(filePath, 'utf-8')
      return this.filterLines(content, options?.startLine, options?.endLine)
    } catch (error) {
      logger.error(
        { taskId: this.executor.taskId, filename, error },
        'read_file_error'
      )
      throw error
    }
  }

  /**
   * Write file (supports full overwrite / by line), immediately synced to database
   */
  async write(
    filename: string,
    content: string,
    options?: { startLine?: number; append?: boolean }
  ): Promise<void> {
    try {
      const filePath = await this.ensureFileInCache(filename)
      const existingContent =
        options?.startLine !== undefined || options?.append
          ? await fs.readFile(filePath, 'utf-8').catch(() => '')
          : ''
      const finalContent = this.mergeContent(existingContent, content, options)
      await fs.writeFile(filePath, finalContent, 'utf-8')
      await this.syncToDatabase(filename, finalContent)
      this.emit('write', filename, finalContent)
      logger.debug({ taskId: this.executor.taskId, filename }, 'file_written')
    } catch (error) {
      logger.error(
        { taskId: this.executor.taskId, filename, error },
        'write_file_error'
      )
      throw error
    }
  }

  /**
   * Clear task cache directory (only clears the file directory, preserves logs)
   */
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.fileDir, { recursive: true, force: true })
      logger.info(
        { taskId: this.executor.taskId, path: this.fileDir },
        'cache_cleaned'
      )
    } catch (error) {
      logger.error({ taskId: this.executor.taskId, error }, 'cleanup_error')
      throw error
    }
  }

  /**
   * Ensure file is in cache (retrieve from DB or create)
   */
  private async ensureFileInCache(filename: string): Promise<string> {
    const filePath = path.join(this.fileDir, filename)

    try {
      await fs.access(filePath)
      return filePath
    } catch {
      const fileRecord = await agentTaskDb.findAgentTaskFile(
        this.executor.taskId,
        filename
      )

      await fs.mkdir(this.fileDir, { recursive: true })

      if (fileRecord) {
        await fs.writeFile(filePath, fileRecord.content, 'utf-8')
        logger.debug(
          { taskId: this.executor.taskId, filename },
          'file_restored_from_db'
        )
      } else {
        await fs.writeFile(filePath, '', 'utf-8')
        logger.debug(
          { taskId: this.executor.taskId, filename },
          'new_file_created'
        )
      }

      return filePath
    }
  }

  /**
   * Sync to database
   */
  private async syncToDatabase(
    filename: string,
    content: string
  ): Promise<void> {
    try {
      const existingFile = await agentTaskDb.findAgentTaskFile(
        this.executor.taskId,
        filename
      )

      if (existingFile) {
        await agentTaskDb.updateAgentTaskFile(existingFile.id, { content })
      } else {
        await agentTaskDb.createAgentTaskFile({
          tenantId: this.executor.tenantId,
          userId: this.executor.userId,
          agentTaskId: this.executor.taskId,
          path: filename,
          content,
        })
      }

      logger.debug(
        { taskId: this.executor.taskId, filename },
        'file_synced_to_db'
      )
    } catch (error) {
      logger.error(
        { taskId: this.executor.taskId, filename, error },
        'sync_to_db_error'
      )
    }
  }
}
