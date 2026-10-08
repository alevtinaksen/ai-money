import { DesignIcon, Icon } from './Primitives';
// Named adapters retain existing component call sites while using the approved Basil assets.
const symbol = (name: DesignIcon) => function BasilSymbol({ className = '' }: { className?: string }) {
  return <span className={`basil-symbol ${className}`}><Icon name={name} /></span>;
};
export const CloseOutlined = symbol('close');
export const EditOutlined = symbol('edit');
export const DeleteOutlined = symbol('trash');
export const CheckOutlined = symbol('check');
export const ArrowLeftOutlined = symbol('back');
export const CreditCardOutlined = symbol('card');
export const FileTextOutlined = symbol('document');
export const RightOutlined = symbol('right');
