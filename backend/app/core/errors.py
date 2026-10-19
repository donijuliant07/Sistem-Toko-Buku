"""Exception yang wajar dipetakan menjadi 4xx oleh layer API.

`except Exception` juga menelan bug pemrograman (AttributeError, NameError dari
kode sendiri) dan menyamarkannya sebagai 400, sehingga kegagalan server tidak
pernah terlihat. Tuple ini hanya mencakup kegagalan yang berasal dari input
pengguna serta klien Supabase/HTTP/storage.

`RuntimeError` ikut dimasukkan karena klien Supabase maupun mock-nya melempar
error jaringan/sisi server sebagai `RuntimeError`; bug pemrograman sendiri
tidak pernah berupa `RuntimeError` polos dari kode ini.
"""

import httpx
from postgrest.exceptions import APIError
from storage3.exceptions import StorageApiError

SERVICE_ERRORS = (
    ValueError,
    KeyError,
    TypeError,
    APIError,
    StorageApiError,
    httpx.HTTPError,
    RuntimeError,
)
