'use client';

import type { ReactNode } from 'react';
import { Pre } from 'nextra/components';
import { createContext, use, useId, useState } from 'react';

type CommandVariable = Readonly<{
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  pattern?: string;
  validationMessage?: string;
}>;

type CommandContextValue = Readonly<{
  variables: readonly CommandVariable[];
  values: Record<string, string>;
  setValue: (name: string, value: string) => void;
}>;

const CommandContext = createContext<CommandContextValue | null>(null);

function useCommands() {
  const context = use(CommandContext);
  if (!context) {
    throw new Error('CommandInputs and CommandTemplate must be inside CommandExamples.');
  }
  return context;
}

function isValid(variable: CommandVariable, value: string) {
  return value !== '' && (variable.pattern === undefined || new RegExp(`^(?:${variable.pattern})$`).test(value));
}

export function CommandExamples({ variables, children }: Readonly<{
  variables: readonly CommandVariable[];
  children: ReactNode;
}>) {
  const [values, setValues] = useState<Record<string, string>>({});
  const setValue = (name: string, value: string) => setValues(previous => ({ ...previous, [name]: value }));

  return (
    <CommandContext value={{ variables, values, setValue }}>
      {children}
    </CommandContext>
  );
}

export function CommandInputs() {
  const { variables, values, setValue } = useCommands();
  const id = useId();

  return (
    <div className="command-inputs" data-pagefind-ignore>
      {variables.map((variable) => {
        const value = values[variable.name] ?? '';
        const invalid = value !== '' && !isValid(variable, value.trim());
        const inputId = `${id}-${variable.name}`;
        const descriptionId = `${inputId}-description`;
        const errorId = `${inputId}-error`;
        const hasDescription = Boolean(variable.description);
        return (
          <div key={variable.name}>
            <label htmlFor={inputId}>{variable.label}</label>
            <input
              id={inputId}
              type="text"
              value={value}
              placeholder={variable.placeholder}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={invalid}
              aria-describedby={[hasDescription && descriptionId, invalid && errorId].filter(Boolean).join(' ') || undefined}
              onChange={event => setValue(variable.name, event.target.value)}
            />
            {hasDescription && <p id={descriptionId}>{variable.description}</p>}
            {invalid && (
              <p id={errorId} className="command-input-error" role="status">
                {variable.validationMessage ?? `Enter a valid ${variable.label.toLowerCase()}.`}
              </p>
            )}
          </div>
        );
      })}
      <noscript>Enable JavaScript to update and copy these command examples.</noscript>
    </div>
  );
}

export function CommandBlock({ template, language }: Readonly<{ template: string; language?: string }>) {
  const { variables, values } = useCommands();
  const missing = new Set<string>();
  const code = template.replace(/\{\{([A-Z_]\w*)\}\}/gi, (placeholder, name: string) => {
    const variable = variables.find(variable => variable.name === name);
    if (!variable) {
      throw new Error(`Unknown command variable: ${name}`);
    }
    const value = (values[name] ?? '').trim();
    if (!isValid(variable, value)) {
      missing.add(variable.label);
      return placeholder;
    }
    return value;
  });

  return (
    <div className="command-template">
      <Pre data-language={language} data-copy={missing.size ? undefined : ''}>
        <code>{code}</code>
      </Pre>
      {missing.size > 0 && (
        <p className="command-template-note" data-pagefind-ignore>
          Enter a valid value for
          {' '}
          {Array.from(missing).join(', ')}
          {' '}
          above to complete and copy this command.
        </p>
      )}
    </div>
  );
}
