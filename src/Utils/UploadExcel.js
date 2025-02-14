import axios from "axios";

const uploadExcelFile = async (file, taxCode, cookie) => {
  if (!file) {
    console.error("❌ Không có file để upload!");
    alert("Vui lòng chọn file trước khi upload.");
    return;
  }

  const formData = new FormData();
  formData.append("files", file, file.name);

  try {
    const url = `https://${taxCode}.minvoice.net/api/api/app/tenant-client/upload`;

    const response = await axios.post(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Cookie: cookie,
      },
      withCredentials: true, // Để gửi cookie theo request
    });

    if (response.status === 200) {
      console.log("✅ Upload thành công:", response.data);

      return response.data;
    } else {
      throw new Error(`Lỗi server: ${response.status}`);
    }
  } catch (error) {
    console.error(
      "❌ Upload thất bại:",
      error.response?.message || error.message
    );

    // Trả lỗi để handleFileUpload có thể xử lý tiếp
    throw error.response?.data || new Error("Có lỗi xảy ra khi tải file.");
  }
};

export default uploadExcelFile;
