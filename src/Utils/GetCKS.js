async function GetListCKS(taxCode, token) {
  let sanitizedTaxCode = taxCode.replace(/-/g, "");
  const url = `https://${sanitizedTaxCode}.minvoice.com.vn/api/System/GetDataByWindowNo?window_id=WIN00010&start=0&count=100&continue=null&filter=null&infoparam=null&tlbparam=null`;
  //   const body = {
  //     username: username,
  //     password: password,
  //     ma_dvcs: ma_dvcs,
  //   };

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bear " + token,
      },
      //   body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return { data };
  } catch (error) {
    console.error("Error:", error);
    return { data: null };
  }
}

export default GetListCKS;
