import { assistantId } from "@/app/assistant-config";
import { openai } from "@/app/openai";

// upload file to assistant's vector store
export async function POST(request) {
  const formData = await request.formData(); // process file as FormData
  const file = formData.get("file"); // retrieve the single file from FormData
  const vectorStoreId = await getOrCreateVectorStore(); // get or create vector store

  // upload using the file stream
  const openaiFile = await openai.files.create({
    file: file,
    purpose: "assistants",
  });

  // add file to vector store
  await openai.beta.vectorStores.files.create(vectorStoreId, {
    file_id: openaiFile.id,
  });
  return new Response();
}

// list files in assistant's vector store
// list files in assistant's vector store
export async function GET(request) {
  const params = new URLSearchParams(request.url.split("?")[1]); // Extract query parameters
  const vectorStoreId = await getOrCreateVectorStore(); // get or create vector store
  const page = parseInt(params.get("page")) || 1; // Get page number from query params, default to 1
  const pageSize = parseInt(params.get("pageSize")) || 20; // Get page size from query params, default to 20

  const fileList = await openai.beta.vectorStores.files.list(vectorStoreId, {
    page: page,
    per_page: pageSize,
  });

  const filesArray = await Promise.all(
    fileList.data.map(async (file: any) => {
      const fileDetails = await openai.files.retrieve(file.id);
      const vectorFileDetails = await openai.beta.vectorStores.files.retrieve(
        vectorStoreId,
        file.id
      );
      return {
        file_id: file.id,
        filename: fileDetails.filename,
        status: vectorFileDetails.status,
      };
    })
  );

  // Check if there are more files beyond the current page
  const hasMore = fileList.data.length === pageSize;

  return new Response(JSON.stringify({ files: filesArray, hasMore: hasMore }), {
    headers: { "Content-Type": "application/json" },
  });
}

// delete file from assistant's vector store
export async function DELETE(request) {
  const body = await request.json();
  const fileId = body.fileId;

  const vectorStoreId = await getOrCreateVectorStore(); // get or create vector store
  await openai.beta.vectorStores.files.del(vectorStoreId, fileId); // delete file from vector store

  return new Response();
}

/* Helper functions */

const getOrCreateVectorStore = async () => {
  const assistant = await openai.beta.assistants.retrieve(assistantId);

  // if the assistant already has a vector store, return it
  if (assistant.tool_resources?.file_search?.vector_store_ids?.length > 0) {
    return assistant.tool_resources.file_search.vector_store_ids[0];
  }
  // otherwise, create a new vector store and attatch it to the assistant
  const vectorStore = await openai.beta.vectorStores.create({
    name: "sample-assistant-vector-store",
  });
  await openai.beta.assistants.update(assistantId, {
    tool_resources: {
      file_search: {
        vector_store_ids: [vectorStore.id],
      },
    },
  });
  return vectorStore.id;
};
