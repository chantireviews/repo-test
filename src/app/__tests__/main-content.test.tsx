import { render, screen, fireEvent } from '@testing-library/react';
import { MainContent } from '../main-content';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the child components
vi.mock('@/components/chat/ChatInterface', () => ({
  ChatInterface: () => <div data-testid="chat-interface">Chat</div>,
}));

vi.mock('@/components/editor/FileTree', () => ({
  FileTree: () => <div data-testid="file-tree">File Tree</div>,
}));

vi.mock('@/components/editor/CodeEditor', () => ({
  CodeEditor: () => <div data-testid="code-editor">Code Editor</div>,
}));

vi.mock('@/components/preview/PreviewFrame', () => ({
  PreviewFrame: () => <div data-testid="preview-frame">Preview</div>,
}));

vi.mock('@/components/HeaderActions', () => ({
  HeaderActions: () => <div data-testid="header-actions">Header</div>,
}));

describe('MainContent Toggle Buttons', () => {
  it('should toggle between preview and code views when clicking the toggle buttons', () => {
    render(<MainContent />);

    // Preview should be shown by default
    expect(screen.getByTestId('preview-frame')).toBeInTheDocument();
    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument();

    // Click the Code button
    const codeButton = screen.getByRole('tab', { name: /code/i });
    fireEvent.click(codeButton);

    // Code view should now be shown
    expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-frame')).not.toBeInTheDocument();

    // Click the Preview button
    const previewButton = screen.getByRole('tab', { name: /preview/i });
    fireEvent.click(previewButton);

    // Preview should be shown again
    expect(screen.getByTestId('preview-frame')).toBeInTheDocument();
    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument();
  });
});
