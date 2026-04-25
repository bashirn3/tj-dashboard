import Badge from './Badge.jsx';
import { STATUS_META } from '../../lib/format.js';

export default function StatusPill({ status }) {
  const meta = STATUS_META[status] || { label: status, color: 'gray' };
  return (
    <Badge tone={meta.color} dot>
      {meta.label}
    </Badge>
  );
}
