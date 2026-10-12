"""Lapisan HTTP API.

Berisi definisi endpoint dan pengelompokannya per versi. Modul di sini hanya
boleh menangani penerjemahan HTTP: membaca request, memanggil service, memilih
status code, dan menyusun respons. Business logic dan akses data berada di
`app.services`.
"""
