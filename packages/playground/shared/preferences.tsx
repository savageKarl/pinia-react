'use client'

import { useId } from 'react'

export function PreferenceEditor({
  name,
  theme,
  note,
  onNameChange,
  onThemeChange,
  onNoteChange
}: {
  name: string
  theme: string
  note: string
  onNameChange: (value: string) => void
  onThemeChange: (value: 'light' | 'dark') => void
  onNoteChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className='preferences-demo'>
      <div className='profile-preview' data-theme={theme}>
        <div className='preview-topline'>
          <span>YOUR LITTLE SPACE</span>
          <span className='preview-dot' />
        </div>
        <span className='avatar' aria-hidden='true'>
          {name.charAt(0) || 'A'}
        </span>
        <strong data-testid='preference-name'>{name || 'Your name'}</strong>
        <span className='profile-caption'>Welcome back. Make yourself at home.</span>
      </div>
      <div className='preference-fields'>
        <label htmlFor={`${id}-name`}>
          Display name
          <span className='field-tag' aria-hidden='true'>
            Saved
          </span>
        </label>
        <input
          id={`${id}-name`}
          value={name}
          maxLength={32}
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete='off'
        />
        <fieldset>
          <legend>
            Preview theme
            <span className='field-tag' aria-hidden='true'>
              Saved
            </span>
          </legend>
          <div className='theme-picker'>
            <button type='button' aria-pressed={theme === 'light'} onClick={() => onThemeChange('light')}>
              <span className='theme-swatch light-swatch' />
              Light
            </button>
            <button type='button' aria-pressed={theme === 'dark'} onClick={() => onThemeChange('dark')}>
              <span className='theme-swatch dark-swatch' />
              Dark
            </button>
          </div>
        </fieldset>
        <label htmlFor={`${id}-note`}>
          Temporary note
          <span className='field-tag muted-tag' aria-hidden='true'>
            This visit only
          </span>
        </label>
        <input
          id={`${id}-note`}
          value={note}
          maxLength={120}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder='This note will not be saved'
          autoComplete='off'
        />
      </div>
    </div>
  )
}

export function PreferenceActions({
  onSave,
  onRestore,
  onReset
}: {
  onSave: () => void
  onRestore: () => void
  onReset: () => void
}) {
  return (
    <>
      <div className='persistence-actions'>
        <button className='button-primary' type='button' onClick={() => window.location.reload()}>
          Reload to try it <span aria-hidden='true'>↻</span>
        </button>
        <p>Every change is saved automatically.</p>
      </div>
      <details className='manual-controls'>
        <summary>Manual save and restore</summary>
        <p>Changes save automatically. Use these methods when you need explicit control.</p>
        <div className='button-row'>
          <button className='button-secondary' type='button' onClick={onSave}>
            Save now
          </button>
          <button className='button-secondary' type='button' onClick={onRestore}>
            Restore from storage
          </button>
          <button className='button-text' type='button' onClick={onReset}>
            Reset preferences
          </button>
        </div>
      </details>
    </>
  )
}
