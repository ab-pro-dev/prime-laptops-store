let inMemoryToken = null;

const tokenStore = {
  get: () => inMemoryToken || localStorage.getItem('admin_token'),
  set: (token) => {
    inMemoryToken = token;
    if (token) {
      localStorage.setItem('admin_token', token);
    } else {
      localStorage.removeItem('admin_token');
    }
  },
  clear: () => {
    inMemoryToken = null;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  },
};

export default tokenStore;
