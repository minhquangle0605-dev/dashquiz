import { useNavigate } from 'react-router-dom';

import { Modal } from '@/components/ui/Modal';
import { DiscussionsPanel } from '@/components/shared/DiscussionsPanel';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_DASHBOARDS } from '@/utils/constants';

export default function DiscussionsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (user) {
      navigate(ROLE_DASHBOARDS[user.role], { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <Modal
      isOpen
      onClose={handleClose}
      size="3xl"
      title="Discussions & Announcements"
      description="Exchange questions, post announcements, and reply"
    >
      <DiscussionsPanel />
    </Modal>
  );
}
