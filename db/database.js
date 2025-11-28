import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class Database {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.initializeData();
  }

  initializeData() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Initialize categories.json
    const categoriesFile = path.join(this.dataDir, 'categories.json');
    if (!fs.existsSync(categoriesFile)) {
      const categories = [
        { id: 1, name: 'Elektronik', icon: '🔌' },
        { id: 2, name: 'Furniture', icon: '🪑' },
        { id: 3, name: 'Pakaian', icon: '👕' },
        { id: 4, name: 'Buku', icon: '📚' },
        { id: 5, name: 'Sepatu', icon: '👟' },
        { id: 6, name: 'Lainnya', icon: '📦' }
      ];
      fs.writeFileSync(categoriesFile, JSON.stringify(categories, null, 2));
    }

    // Initialize products.json
    const productsFile = path.join(this.dataDir, 'products.json');
    if (!fs.existsSync(productsFile)) {
      const products = [
        {
          id: 1,
          title: 'Laptop ASUS VivoBook',
          categoryId: 1,
          price: 3500000,
          condition: 'Sangat Baik',
          description: 'Laptop bekas dalam kondisi sangat baik, masih garansi resmi',
          image: '/modern-laptop-workspace.png',
          userId: 1,
          createdAt: new Date().toISOString()
        }
      ];
      fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
    }

    // Initialize users.json
    const usersFile = path.join(this.dataDir, 'users.json');
    if (!fs.existsSync(usersFile)) {
      const users = [
        {
          id: 1,
          name: 'Budi Santoso',
          email: 'budi@example.com',
          phone: '08123456789',
          address: 'Jl. Merdeka No. 123, Jakarta',
          avatar: '/abstract-profile.png',
          products: [1]
        }
      ];
      fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    }
  }

  // Categories methods
  getCategories() {
    try {
      const data = fs.readFileSync(path.join(this.dataDir, 'categories.json'), 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading categories:', error);
      return [];
    }
  }

  // Products methods
  getProducts() {
    try {
      const data = fs.readFileSync(path.join(this.dataDir, 'products.json'), 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading products:', error);
      return [];
    }
  }

  getProductById(id) {
    const products = this.getProducts();
    return products.find(p => p.id === parseInt(id));
  }

  addProduct(product) {
    const products = this.getProducts();
    const newId = Math.max(...products.map(p => p.id), 0) + 1;
    const newProduct = { id: newId, ...product, createdAt: new Date().toISOString() };
    products.push(newProduct);
    fs.writeFileSync(path.join(this.dataDir, 'products.json'), JSON.stringify(products, null, 2));
    return newProduct;
  }

  getProductsByCategory(categoryId) {
    const products = this.getProducts();
    return products.filter(p => p.categoryId === parseInt(categoryId));
  }

  getProductsByUser(userId) {
    const products = this.getProducts();
    return products.filter(p => p.userId === parseInt(userId));
  }

  // Users methods
  getUsers() {
    try {
      const data = fs.readFileSync(path.join(this.dataDir, 'users.json'), 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading users:', error);
      return [];
    }
  }

  getUserById(id) {
    const users = this.getUsers();
    return users.find(u => u.id === parseInt(id));
  }

  addUser(user) {
    const users = this.getUsers();
    const newId = Math.max(...users.map(u => u.id), 0) + 1;
    const newUser = { id: newId, ...user, products: [] };
    users.push(newUser);
    fs.writeFileSync(path.join(this.dataDir, 'users.json'), JSON.stringify(users, null, 2));
    return newUser;
  }

  updateUser(id, updatedData) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === parseInt(id));
    if (index !== -1) {
      users[index] = { ...users[index], ...updatedData };
      fs.writeFileSync(path.join(this.dataDir, 'users.json'), JSON.stringify(users, null, 2));
      return users[index];
    }
    return null;
  }
}

export default Database;
