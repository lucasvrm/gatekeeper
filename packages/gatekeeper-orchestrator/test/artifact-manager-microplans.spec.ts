/**
 * Tests for ArtifactManager microplans methods
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { ArtifactManager } from '../src/artifact-manager.js'
import type { MicroplansDocument, Microplan } from '../src/types.js'

// Mock fs module
vi.mock('fs')

describe('ArtifactManager - Microplans', () => {
  let artifactManager: ArtifactManager
  const testRunDir = '/test/run/dir'
  const microplansPath = path.join(testRunDir, 'microplans.json')

  const mockMicroplansDoc: MicroplansDocument = {
    task: 'Test task',
    microplans: [
      {
        id: 'MP-1',
        goal: 'First microplan',
        depends_on: [],
        files: [{ path: 'file1.ts', action: 'CREATE', what: 'Create file1' }],
        verify: 'npm test',
      },
      {
        id: 'MP-2',
        goal: 'Second microplan',
        depends_on: ['MP-1'],
        files: [{ path: 'file2.ts', action: 'EDIT', what: 'Edit file2' }],
        verify: 'npm test',
      },
    ],
  }

  beforeEach(() => {
    artifactManager = new ArtifactManager('/test/artifacts')
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('readMicroplans', () => {
    it('should read and parse microplans.json successfully', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockMicroplansDoc))

      const result = await artifactManager.readMicroplans(testRunDir)

      expect(fs.readFileSync).toHaveBeenCalledWith(microplansPath, 'utf-8')
      expect(result).toEqual(mockMicroplansDoc)
    })

    it('should throw error if file does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw error
      })

      await expect(artifactManager.readMicroplans(testRunDir)).rejects.toThrow(
        `microplans.json not found in ${testRunDir}`
      )
    })

    it('should throw error if JSON is invalid', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json{')

      await expect(artifactManager.readMicroplans(testRunDir)).rejects.toThrow(
        'Failed to parse microplans.json'
      )
    })
  })

  describe('saveMicroplans', () => {
    it('should format and save microplans.json with 2-space indentation', async () => {
      await artifactManager.saveMicroplans(testRunDir, mockMicroplansDoc)

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        microplansPath,
        JSON.stringify(mockMicroplansDoc, null, 2),
        'utf-8'
      )
    })
  })

  describe('getMicroplanById', () => {
    it('should return microplan when found', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockMicroplansDoc))

      const result = await artifactManager.getMicroplanById(testRunDir, 'MP-2')

      expect(result).toEqual(mockMicroplansDoc.microplans[1])
    })

    it('should return null when microplan not found', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockMicroplansDoc))

      const result = await artifactManager.getMicroplanById(testRunDir, 'MP-999')

      expect(result).toBeNull()
    })

    it('should return null when file does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw error
      })

      const result = await artifactManager.getMicroplanById(testRunDir, 'MP-1')

      expect(result).toBeNull()
    })
  })

  describe('listMicroplanIds', () => {
    it('should return array of all microplan IDs', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockMicroplansDoc))

      const result = await artifactManager.listMicroplanIds(testRunDir)

      expect(result).toEqual(['MP-1', 'MP-2'])
    })

    it('should return empty array when file does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw error
      })

      const result = await artifactManager.listMicroplanIds(testRunDir)

      expect(result).toEqual([])
    })
  })
})
