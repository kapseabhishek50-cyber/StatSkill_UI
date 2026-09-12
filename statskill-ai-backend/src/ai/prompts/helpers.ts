export const priorityLabel = (priority: string): string =>
  ({ CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' }[priority] ?? priority);
