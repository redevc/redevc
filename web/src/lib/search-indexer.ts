import fs from 'fs';
import path from 'path';

export interface SearchIndexItem {
  title: string;
  route: string;
  content: string;
  category: string;
}

export function generateSearchIndex(): SearchIndexItem[] {
  const appDir = path.join(process.cwd(), 'src/app');
  const index: SearchIndexItem[] = [];

  function walk(dir: string, route: string = '') {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath, `${route}/${file}`);
      } else if (file === 'page.tsx') {
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // Extração simples de título e conteúdo (pode ser melhorada)
        const titleMatch = content.match(/title:\s*["'](.*?)["']/);
        const title = titleMatch ? titleMatch[1] : (route === '' ? 'Home' : route.split('/').pop() || 'Página');
        
        index.push({
          title: title.charAt(0).toUpperCase() + title.slice(1),
          route: route === '' ? '/' : route,
          content: content.replace(/<[^>]*>?/gm, '').slice(0, 200), // Remove tags e limita
          category: route.split('/')[1] || 'Geral'
        });
      }
    }
  }

  if (fs.existsSync(appDir)) {
    walk(appDir);
  }

  return index;
}
