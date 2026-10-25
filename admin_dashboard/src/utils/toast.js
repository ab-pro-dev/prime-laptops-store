import toast from 'react-hot-toast';

export default {
  success: (msg) =>
    toast.success(msg, {
      style: {
        background: '#0d1320',
        color: '#f8fafc',
        border: '1px solid rgba(32, 240, 255, 0.4)',
        boxShadow: '0 0 20px rgba(32, 240, 255, 0.15)',
        fontFamily: 'Figtree, sans-serif',
      },
      iconTheme: { primary: '#20f0ff', secondary: '#07090f' },
    }),
  error: (msg) =>
    toast.error(msg, {
      style: {
        background: '#0d1320',
        color: '#f8fafc',
        border: '1px solid rgba(244, 63, 94, 0.4)',
        boxShadow: '0 0 20px rgba(244, 63, 94, 0.15)',
        fontFamily: 'Figtree, sans-serif',
      },
      iconTheme: { primary: '#f43f5e', secondary: '#07090f' },
    }),
  info: (msg) =>
    toast(msg, {
      style: {
        background: '#0d1320',
        color: '#f8fafc',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        fontFamily: 'Figtree, sans-serif',
      },
    }),
};
