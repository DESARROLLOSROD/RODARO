type Status = 'COMPLETA' | 'INCOMPLETA' | 'INVALIDA' | 'NO_REALIZADA' | 'A_TIEMPO' | 'RETRASADO' | 'OMITIDO';

const statusConfig: Record<Status, { label: string; color: string }> = {
  COMPLETA: { label: 'Completa', color: 'bg-green-100 text-green-800' },
  INCOMPLETA: { label: 'Incompleta', color: 'bg-yellow-100 text-yellow-800' },
  INVALIDA: { label: 'Inválida', color: 'bg-red-100 text-red-800' },
  NO_REALIZADA: { label: 'No realizada', color: 'bg-gray-100 text-gray-800' },
  A_TIEMPO: { label: 'A tiempo', color: 'bg-green-100 text-green-800' },
  RETRASADO: { label: 'Retrasado', color: 'bg-yellow-100 text-yellow-800' },
  OMITIDO: { label: 'Omitido', color: 'bg-red-100 text-red-800' }
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-800' };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} ${className}`}
    >
      {config.label}
    </span>
  );
}
