export default async function handler(req, res) {
  // Thêm CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Accept-Language, Cache-Control, Connection, Pragma, Referer, User-Agent');

  // Xử lý OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Chỉ cho phép GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Lấy URL từ query parameter
  const { url: targetUrl } = req.query;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // Lấy headers từ query (axios sẽ gửi headers trong query khi dùng proxy)
    const headers = {};
    if (req.query.authorization) headers['Authorization'] = req.query.authorization;
    if (req.query.accept) headers['Accept'] = req.query.accept;
    if (req.query['accept-language']) headers['Accept-Language'] = req.query['accept-language'];
    if (req.query['cache-control']) headers['Cache-Control'] = req.query['cache-control'];
    if (req.query.connection) headers['Connection'] = req.query.connection;
    if (req.query.pragma) headers['Pragma'] = req.query.pragma;
    if (req.query.referer) headers['Referer'] = req.query.referer;
    if (req.query['user-agent']) headers['User-Agent'] = req.query['user-agent'];
    if (req.query['content-type']) headers['Content-Type'] = req.query['content-type'];

    // Gọi API HTTP từ server-side (không bị chặn bởi Mixed Content)
    const fetchResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        ...headers,
        'User-Agent': headers['User-Agent'] || 'Mozilla/5.0',
      },
    });
    
    // Lấy content type từ response
    const contentType = fetchResponse.headers.get('content-type') || 'application/json';
    
    // Nếu là blob (PDF, XML), trả về binary
    if (contentType.includes('application/pdf') || 
        contentType.includes('application/xml') || 
        contentType.includes('text/xml') ||
        contentType.includes('application/octet-stream')) {
      const buffer = await fetchResponse.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', fetchResponse.headers.get('content-disposition') || 'attachment');
      return res.send(Buffer.from(buffer));
    }

    // Nếu là JSON hoặc text, trả về text
    const data = await fetchResponse.text();
    res.setHeader('Content-Type', contentType);
    return res.status(fetchResponse.status).send(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message 
    });
  }
}
